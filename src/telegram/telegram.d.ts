export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }

  interface TelegramWebApp {
    initData: string;
    initDataUnsafe: any;
    version: string;
    platform: string;
    colorScheme: "light" | "dark";
    themeParams: Record<string, string | undefined>;
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    MainButton: {
      setText(text: string): any;
      show(): any;
      hide(): any;
      enable(): any;
      disable(): any;
      onClick(cb: () => void): any;
      offClick(cb: () => void): any;
    };
    BackButton: {
      show(): any;
      hide(): any;
      onClick(cb: () => void): any;
      offClick(cb: () => void): any;
    };
    SettingsButton?: {
      show(): any;
      hide(): any;
      onClick(cb: () => void): any;
      offClick(cb: () => void): any;
    };
    HapticFeedback?: {
      impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): any;
      notificationOccurred(type: "error" | "success" | "warning"): any;
      selectionChanged(): any;
    };
    ready(): void;
    expand(): void;
    close(): void;
    onEvent(eventType: string, cb: (...args: any[]) => void): void;
    offEvent(eventType: string, cb: (...args: any[]) => void): void;
    showAlert?(message: string, cb?: () => void): void;
    showConfirm?(
      message: string,
      cb?: (isConfirmed: boolean) => void
    ): void;
    setHeaderColor?(color: string): void;
    setBackgroundColor?(color: string): void;
    sendData?(data: string): void;
  }
}

