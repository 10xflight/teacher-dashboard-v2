import { ToastProvider } from '@/components/Toast';

export default function FullscreenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
