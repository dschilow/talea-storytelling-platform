import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { secret } from "encore.dev/config";
import crypto from "crypto";

type UploadMode = "off" | "data" | "always";

type BucketConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
  uploadMode: UploadMode;
};

const bucketEndpointSecret = secret("BucketEndpoint");
const bucketRegionSecret = secret("BucketRegion");
const bucketNameSecret = secret("BucketName");
const bucketAccessKeySecret = secret("BucketAccessKeyId");
const bucketSecretKeySecret = secret("BucketSecretAccessKey");
const bucketPublicBaseUrlSecret = secret("BucketPublicBaseUrl");
const bucketForcePathStyleSecret = secret("BucketForcePathStyle");
const bucketUploadModeSecret = secret("BucketUploadMode");

let cachedConfig: BucketConfig | null | undefined;
let cachedClient: S3Client | null | undefined;

const safeSecret = (reader: () => string): string | undefined => {
  try {
    const value = reader();
    return value ? value.trim() : undefined;
  } catch {
    return undefined;
  }
};

const normalizeEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const parseBool = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
};

const parseUploadMode = (value: string | undefined): UploadMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "off") return "off";
  if (normalized === "always") return "always";
  return "data";
};

const pickConfig = (): BucketConfig | null => {
  if (cachedConfig !== undefined) return cachedConfig;

  const endpoint = safeSecret(bucketEndpointSecret) || process.env.BUCKET_ENDPOINT;
  const bucket = safeSecret(bucketNameSecret) || process.env.BUCKET_NAME;
  const accessKeyId = safeSecret(bucketAccessKeySecret) || process.env.BUCKET_ACCESS_KEY_ID;
  const secretAccessKey = safeSecret(bucketSecretKeySecret) || process.env.BUCKET_SECRET_ACCESS_KEY;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    cachedConfig = null;
    return cachedConfig;
  }

  const region =
    safeSecret(bucketRegionSecret) ||
    process.env.BUCKET_REGION ||
    "auto";
  const publicBaseUrl =
    safeSecret(bucketPublicBaseUrlSecret) ||
    process.env.BUCKET_PUBLIC_BASE_URL;
  const forcePathStyle = parseBool(
    safeSecret(bucketForcePathStyleSecret) || process.env.BUCKET_FORCE_PATH_STYLE,
    false
  );
  const uploadMode = parseUploadMode(
    safeSecret(bucketUploadModeSecret) || process.env.BUCKET_UPLOAD_MODE
  );

  cachedConfig = {
    endpoint: normalizeEndpoint(endpoint),
    region: region.trim(),
    bucket: bucket.trim(),
    accessKeyId: accessKeyId.trim(),
    secretAccessKey: secretAccessKey.trim(),
    publicBaseUrl: publicBaseUrl?.trim(),
    forcePathStyle,
    uploadMode,
  };
  return cachedConfig;
};

const getClient = (config: BucketConfig): S3Client => {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: config.region || "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
  return cachedClient;
};

const extFromContentType = (contentType: string): string => {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("gif")) return "gif";
  return "bin";
};

const buildPublicUrl = (config: BucketConfig, key: string): string => {
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  }

  const endpointUrl = new URL(config.endpoint);
  if (config.forcePathStyle) {
    return `${endpointUrl.origin}/${config.bucket}/${key}`;
  }
  return `${endpointUrl.protocol}//${config.bucket}.${endpointUrl.host}/${key}`;
};

const parseDataUrl = (dataUrl: string): { contentType: string; buffer: Buffer } | null => {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1].trim();
  const base64 = match[2];
  if (!contentType || !base64) return null;
  return { contentType, buffer: Buffer.from(base64, "base64") };
};

export type BucketUploadResult = { url: string; key: string };

export type BucketUploadOptions = {
  prefix?: string;
  filenameHint?: string;
  uploadMode?: UploadMode;
};

export async function maybeUploadImageUrlToBucket(
  imageUrl: string | undefined,
  options: BucketUploadOptions = {}
): Promise<BucketUploadResult | null> {
  if (!imageUrl) return null;

  const config = pickConfig();
  if (!config || config.uploadMode === "off") {
    return null;
  }

  const uploadMode = options.uploadMode ?? config.uploadMode;
  const isDataUrl = imageUrl.startsWith("data:");
  const isHttpUrl = /^https?:\/\//i.test(imageUrl);

  if (isDataUrl && uploadMode === "data") {
    return await uploadDataUrl(config, imageUrl, options);
  }

  if (isHttpUrl && uploadMode === "always") {
    return await uploadRemoteUrl(config, imageUrl, options);
  }

  if (isDataUrl && uploadMode === "always") {
    return await uploadDataUrl(config, imageUrl, options);
  }

  return null;
}

const uploadDataUrl = async (
  config: BucketConfig,
  dataUrl: string,
  options: BucketUploadOptions
): Promise<BucketUploadResult | null> => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  return await uploadBuffer(config, parsed.buffer, parsed.contentType, options);
};

const uploadRemoteUrl = async (
  config: BucketConfig,
  sourceUrl: string,
  options: BucketUploadOptions
): Promise<BucketUploadResult | null> => {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`[Bucket] Failed to download source image (${res.status})`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await res.arrayBuffer();
    return await uploadBuffer(config, Buffer.from(arrayBuffer), contentType, options);
  } catch (error) {
    console.warn("[Bucket] Failed to download source image:", error);
    return null;
  }
};

const uploadBuffer = async (
  config: BucketConfig,
  buffer: Buffer,
  contentType: string,
  options: BucketUploadOptions
): Promise<BucketUploadResult | null> => {
  if (!buffer || buffer.length === 0) return null;

  const client = getClient(config);
  const prefix = (options.prefix || "images").replace(/^\/+|\/+$/g, "");
  const ext = extFromContentType(contentType);
  const uuid = crypto.randomUUID();
  const baseName = options.filenameHint ? options.filenameHint.replace(/[^a-z0-9-_]/gi, "") : uuid;
  const key = `${prefix}/${baseName}-${uuid}.${ext}`.replace(/\/+/g, "/");

  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
    const url = buildPublicUrl(config, key);
    console.log(`[Bucket] Uploaded image to ${key}`);
    return { url, key };
  } catch (error) {
    console.warn("[Bucket] Upload failed:", error);
    return null;
  }
};
