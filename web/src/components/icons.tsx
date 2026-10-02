import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Cable,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Clock3,
  Copy,
  ExternalLink,
  Globe,
  GitBranch,
  History,
  Home,
  Image,
  Info,
  KeyRound,
  ListChecks,
  Loader2,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  MoreVertical,
  Palette,
  Pause,
  Pencil,
  Power,
  Play,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  Settings2,
  ShieldCheck,
  Split,
  Sun,
  Trash2,
  TriangleAlert,
  Eye,
  EyeOff,
  UserRound,
  Webhook,
  Workflow as WorkflowIcon,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Mapping terpusat: tipe node/trigger workflow -> icon Lucide. */
const NODE_ICONS: Record<string, LucideIcon> = {
  http_request: Globe,
  condition: GitBranch,
  transform: Zap,
  delay: Clock,
  log: ScrollText,
  send_telegram: Send,
  send_waha: MessageCircle,
  send_waha_media: Image,
  ai_chat: Bot,
  manual: Play,
  webhook: Webhook,
  schedule: CalendarClock,
  telegram_event: Send,
  waha_event: MessageCircle,
};

export function NodeTypeIcon({ type, size = 18 }: { type: string; size?: number }) {
  const Cmp = NODE_ICONS[type] || Plug;
  return <Cmp size={size} aria-hidden />;
}

/** Mapping terpusat: provider -> logo brand lokal. Fallback: Plug. */
const PROVIDER_ASSETS: Record<string, string> = {
  waha: "/icons/providers/waha.png",
  whatsapp: "/icons/providers/whatsapp.svg",
  telegram: "/icons/providers/telegram.svg",
};

export function ProviderIcon({ provider, size = 20 }: { provider: string; size?: number }) {
  const src = PROVIDER_ASSETS[provider.toLowerCase()];
  if (!src) return <Plug size={size} aria-hidden />;
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", flexShrink: 0 }}
    />
  );
}

/** Icon template: coba provider dulu, lalu nama icon Lucide generik. */
export function TemplateIcon({ icon, size = 22 }: { icon: string; size?: number }) {
  const key = icon.toLowerCase();
  if (PROVIDER_ASSETS[key]) return <ProviderIcon provider={key} size={size} />;
  if (key === "globe" || key === "http") return <Globe size={size} aria-hidden />;
  return <Plug size={size} aria-hidden />;
}

export {
  ArrowLeft,
  ArrowRight,
  Bot,
  Cable,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Clock3,
  Copy,
  ExternalLink,
  Globe,
  GitBranch,
  History,
  Home,
  Image,
  Info,
  KeyRound,
  ListChecks,
  Loader2,
  Menu,
  MessageCircle,
  Minus,
  Monitor,
  Moon,
  MoreVertical,
  Palette,
  Pause,
  Pencil,
  Power,
  Play,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Search,
  Send,
  Settings,
  Settings2,
  ShieldCheck,
  Split,
  Sun,
  Trash2,
  TriangleAlert,
  Eye,
  EyeOff,
  UserRound,
  Webhook,
  Workflow,
  WorkflowIcon,
  X,
  Zap,
};
