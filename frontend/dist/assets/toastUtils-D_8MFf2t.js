const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-CnuXZQd6.js","assets/index-CC8gWGfT.css"])))=>i.map(i=>d[i]);
import { c as createLucideIcon, C as CircleCheckBig, j as jsxRuntimeExports, m as motion, X, _ as __vitePreload, t as toast, B as Brain, a as BookOpen, U as User } from "./index-CnuXZQd6.js";
/**
 * @license lucide-react v0.484.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["line", { x1: "12", x2: "12", y1: "8", y2: "12", key: "1pkeuh" }],
  ["line", { x1: "12", x2: "12.01", y1: "16", y2: "16", key: "4dfq90" }]
];
const CircleAlert = createLucideIcon("circle-alert", __iconNode$2);
/**
 * @license lucide-react v0.484.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  [
    "path",
    {
      d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      key: "wmoenq"
    }
  ],
  ["path", { d: "M12 9v4", key: "juzpu7" }],
  ["path", { d: "M12 17h.01", key: "p32p05" }]
];
const TriangleAlert = createLucideIcon("triangle-alert", __iconNode$1);
/**
 * @license lucide-react v0.484.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["path", { d: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6", key: "17hqa7" }],
  ["path", { d: "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", key: "lmptdp" }],
  ["path", { d: "M4 22h16", key: "57wxv0" }],
  ["path", { d: "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22", key: "1nw9bq" }],
  ["path", { d: "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22", key: "1np0yb" }],
  ["path", { d: "M18 2H6v7a6 6 0 0 0 12 0V2Z", key: "u46fv3" }]
];
const Trophy = createLucideIcon("trophy", __iconNode);
const Alert = ({
  variant = "info",
  icon,
  children,
  onClose
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return "bg-green-50 border-green-200 text-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
      case "destructive":
        return "bg-red-50 border-red-200 text-red-800";
      case "mono":
        return "bg-white border-gray-200 text-gray-800 shadow-lg";
      default:
        return "bg-blue-50 border-blue-200 text-blue-800";
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      initial: { opacity: 0, y: -20, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, y: -20, scale: 0.95 },
      className: `relative flex items-start gap-3 p-4 rounded-lg border ${getVariantStyles()} max-w-sm`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-1", children }),
        onClose && /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: onClose,
            className: "flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(X, { className: "w-4 h-4" })
          }
        )
      ]
    }
  );
};
const AlertIcon = ({ children }) => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex-shrink-0 w-5 h-5", children });
};
const AlertTitle = ({ children }) => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium text-sm", children });
};
const AlertIcons = {
  Success: CircleCheckBig,
  Warning: TriangleAlert,
  Destructive: CircleAlert
};
const showPersonalityUpdateToast = async (changes) => {
  const { getTraitLabel, getTraitIcon, getSubcategoryLabel, getSubcategoryIcon } = await __vitePreload(async () => {
    const { getTraitLabel: getTraitLabel2, getTraitIcon: getTraitIcon2, getSubcategoryLabel: getSubcategoryLabel2, getSubcategoryIcon: getSubcategoryIcon2 } = await import("./index-CnuXZQd6.js").then((n) => n.b);
    return { getTraitLabel: getTraitLabel2, getTraitIcon: getTraitIcon2, getSubcategoryLabel: getSubcategoryLabel2, getSubcategoryIcon: getSubcategoryIcon2 };
  }, true ? __vite__mapDeps([0,1]) : void 0);
  const totalChanges = changes.reduce((sum, change) => sum + Math.abs(change.change), 0);
  const message = `Persönlichkeit entwickelt sich! ${totalChanges} Änderungen`;
  const formattedChanges = changes.map((change) => {
    let label;
    let icon;
    if (change.trait.includes(".")) {
      const [mainCategory, subcategory] = change.trait.split(".");
      label = getSubcategoryLabel(subcategory, "de");
      icon = getSubcategoryIcon(subcategory);
    } else {
      label = getTraitLabel(change.trait, "de");
      icon = getTraitIcon(change.trait);
    }
    const value = change.change > 0 ? `+${change.change}` : `${change.change}`;
    return { label, icon, value };
  });
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "success", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Brain, { className: "w-5 h-5 text-green-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(AlertTitle, { children: message }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs space-y-1 mt-2", children: formattedChanges.map((change, index) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", children: change.icon }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium", children: [
            change.label,
            ":"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `font-bold ${change.value.startsWith("+") ? "text-green-700" : "text-red-700"}`, children: change.value })
        ] }, index)) })
      ] })
    ] }),
    { duration: 8e3 }
  );
};
const showStoryCompletionToast = (storyTitle) => {
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "success", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(BookOpen, { className: "w-5 h-5 text-green-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertTitle, { children: [
        "Geschichte abgeschlossen: ",
        storyTitle
      ] })
    ] }),
    { duration: 4e3 }
  );
};
const showQuizCompletionToast = (score) => {
  const isGoodScore = score >= 70;
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: isGoodScore ? "success" : "info", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trophy, { className: `w-5 h-5 ${isGoodScore ? "text-green-600" : "text-blue-600"}` }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertTitle, { children: [
        "Quiz abgeschlossen: ",
        score,
        "% richtig!"
      ] })
    ] }),
    { duration: 4e3 }
  );
};
const showAvatarCreatedToast = (avatarName) => {
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "success", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(User, { className: "w-5 h-5 text-green-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(AlertTitle, { children: [
        "Avatar erstellt: ",
        avatarName
      ] })
    ] }),
    { duration: 4e3 }
  );
};
const showSuccessToast = (message) => {
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "success", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcons.Success, { className: "w-5 h-5 text-green-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertTitle, { children: message })
    ] }),
    { duration: 4e3 }
  );
};
const showWarningToast = (message) => {
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "warning", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcons.Warning, { className: "w-5 h-5 text-yellow-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertTitle, { children: message })
    ] }),
    { duration: 4e3 }
  );
};
const showErrorToast = (message) => {
  toast.custom(
    (t) => /* @__PURE__ */ jsxRuntimeExports.jsxs(Alert, { variant: "destructive", onClose: () => toast.dismiss(t), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcon, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlertIcons.Destructive, { className: "w-5 h-5 text-red-600" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AlertTitle, { children: message })
    ] }),
    { duration: 5e3 }
  );
};
export {
  showAvatarCreatedToast,
  showErrorToast,
  showPersonalityUpdateToast,
  showQuizCompletionToast,
  showStoryCompletionToast,
  showSuccessToast,
  showWarningToast
};
