import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

type UploadMode = "off" | "data" | "always";
type AccessMode = "public" | "private";

type BucketConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
  uploadMode: UploadMode;
  accessMode: AccessMode;
  signedUrlTtlSeconds: number;
};

let cachedConfig: BucketConfig | null | undefined;
let cachedClient: S3Client | null | undefined;

const safeSecret = async (name: string): Promise<string | undefined> => {
  try {
    const { secret } = await import("encore.dev/config");
    const value = secret(name)();
    return value ? value.trim() : undefined;
  } catch {
    return undefined;
  }
};

const getEnv = async (name: string): Promise<string | undefined> => {
  const secretValue = await safeSecret(name);
  if (secretValue) return secretValue;
  return process.env[name]?.trim();
};

const syncEnv = (name: string): string | undefined => {
  try {
    return process.env[name]?.trim();
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

const parseAccessMode = (value: string | undefined, publicBaseUrl?: string): AccessMode => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "private") return "private";
  if (normalized === "public") return "public";
  return publicBaseUrl ? "public" : "private";
};

const parseSignedUrlTtl = (value: string | undefined, defaultValue = 3600): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
};

const pickConfig = async (): Promise<BucketConfig | null> => {
  if (cachedConfig !== undefined) return cachedConfig;

  const endpoint = await getEnv("BucketEndpoint") || syncEnv("BUCKET_ENDPOINT");
  const bucket = await getEnv("BucketName") || syncEnv("BUCKET_NAME");
  const accessKeyId = await getEnv("BucketAccessKeyId") || syncEnv("BUCKET_ACCESS_KEY_ID");
  const secretAccessKey = await getEnv("BucketSecretAccessKey") || syncEnv("BUCKET_SECRET_ACCESS_KEY");

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    cachedConfig = null;
    return cachedConfig;
  }

  const region =
    (await getEnv("BucketRegion")) ||
    syncEnv("BUCKET_REGION") ||
    "auto";
  const publicBaseUrl =
    (await getEnv("BucketPublicBaseUrl")) ||
    syncEnv("BUCKET_PUBLIC_BASE_URL");
  const forcePathStyle = parseBool(
    (await getEnv("BucketForcePathStyle")) || syncEnv("BUCKET_FORCE_PATH_STYLE"),
    false
  );
  const uploadMode = parseUploadMode(
    (await getEnv("BucketUploadMode")) || syncEnv("BUCKET_UPLOAD_MODE")
  );
  const accessMode = parseAccessMode(
    (await getEnv("BucketAccessMode")) || syncEnv("BUCKET_ACCESS_MODE"),
    publicBaseUrl
  );
  const signedUrlTtlSeconds = parseSignedUrlTtl(
    (await getEnv("BucketSignedUrlTtlSeconds")) || syncEnv("BUCKET_SIGNED_URL_TTL")
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
    accessMode,
    signedUrlTtlSeconds,
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

const buildStoredUrl = (config: BucketConfig, key: string): string => {
  if (config.accessMode === "public") {
    return buildPublicUrl(config, key);
  }
  return `bucket://${config.bucket}/${key}`;
};

const extractBucketKey = (value: string, config: BucketConfig): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("bucket://") || trimmed.startsWith("s3://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname && parsed.hostname !== config.bucket) {
        return null;
      }
      const key = parsed.pathname.replace(/^\/+/, "");
      return key || null;
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.startsWith(`${config.bucket}.`)) {
        const key = parsed.pathname.replace(/^\/+/, "");
        return key || null;
      }
      const pathParts = parsed.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 2 && pathParts[0] === config.bucket) {
        return pathParts.slice(1).join("/");
      }
    } catch {
      return null;
    }
  }
  return null;
};

const signObjectUrl = async (
  config: BucketConfig,
  key: string,
  ttlSeconds?: number
): Promise<string> => {
  const client = getClient(config);
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });
  const expiresIn = ttlSeconds ?? config.signedUrlTtlSeconds;
  return await getSignedUrl(client, command, { expiresIn });
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

  const config = await pickConfig();
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
    const url = buildStoredUrl(config, key);
    console.log(`[Bucket] Uploaded image to ${key}`);
    return { url, key };
  } catch (error) {
    console.warn("[Bucket] Upload failed:", error);
    return null;
  }
};

export async function resolveImageUrlForClient(
  imageUrl: string | undefined,
  ttlSeconds?: number
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  const config = await pickConfig();
  if (!config) return imageUrl;

  const key = extractBucketKey(imageUrl, config);
  if (!key) return imageUrl;

  if (config.accessMode === "public") {
    return buildPublicUrl(config, key);
  }

  try {
    return await signObjectUrl(config, key, ttlSeconds);
  } catch (error) {
    console.warn("[Bucket] Failed to sign URL:", error);
    return imageUrl;
  }
}

export async function resolveImageUrlForExternalUse(
  imageUrl: string | undefined,
  ttlSeconds?: number
): Promise<string | undefined> {
  return await resolveImageUrlForClient(imageUrl, ttlSeconds);
}
