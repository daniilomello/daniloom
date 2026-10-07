import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "../components/ui";

type AlertType = "info" | "warning" | "error" | "success";

type ConfirmOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title?: string;
  placeholder?: string;
  confirmText?: string;
  defaultValue?: string;
};

type AlertOptions = {
  title?: string;
  type?: AlertType;
};

type DialogApi = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
  alert: (message: string, options?: AlertOptions) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

type Kind = "confirm" | "prompt" | "alert";

type DialogState = {
  kind: Kind;
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  placeholder?: string;
  type?: AlertType;
};

const alertMeta: Record<AlertType, { title: string; icon: ReactNode }> = {
  info: { title: "Aviso", icon: <Info className="w-5 h-5 text-fg-muted" /> },
  warning: {
    title: "Atenção",
    icon: <AlertTriangle className="w-5 h-5 text-warning-fg" />,
  },
  error: {
    title: "Erro",
    icon: <XCircle className="w-5 h-5 text-danger-fg" />,
  },
  success: {
    title: "Pronto",
    icon: <CheckCircle className="w-5 h-5 text-success-fg" />,
  },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const [value, setValue] = useState("");
  const resolveRef = useRef<
    ((result: boolean | string | null | void) => void) | null
  >(null);

  const close = useCallback(() => setState(null), []);

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve as (
          result: boolean | string | null | void,
        ) => void;
        setState({
          kind: "confirm",
          message,
          title: options.title ?? "Confirmar",
          confirmText: options.confirmText ?? "Confirmar",
          cancelText: options.cancelText ?? "Cancelar",
          destructive: options.destructive ?? false,
        });
      });
    },
    [],
  );

  const prompt = useCallback((message: string, options: PromptOptions = {}) => {
    return new Promise<string | null>((resolve) => {
      resolveRef.current = resolve as (
        result: boolean | string | null | void,
      ) => void;
      setValue(options.defaultValue ?? "");
      setState({
        kind: "prompt",
        message,
        title: options.title ?? "Entrada",
        confirmText: options.confirmText ?? "Confirmar",
        cancelText: "Cancelar",
        destructive: false,
        placeholder: options.placeholder,
      });
    });
  }, []);

  const alert = useCallback((message: string, options: AlertOptions = {}) => {
    return new Promise<void>((resolve) => {
      resolveRef.current = resolve as (
        result: boolean | string | null | void,
      ) => void;
      const type = options.type ?? "info";
      setState({
        kind: "alert",
        message,
        title: options.title ?? alertMeta[type].title,
        confirmText: "OK",
        cancelText: "",
        destructive: false,
        type,
      });
    });
  }, []);

  useEffect(() => {
    const original = window.alert;
    window.alert = (message?: unknown) => {
      void alert(String(message ?? ""));
    };
    return () => {
      window.alert = original;
    };
  }, [alert]);

  const finish = (result: boolean | string | null | void) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    close();
  };

  const iconWrap = (type: AlertType) => {
    const tone =
      type === "success"
        ? "bg-muted border-line"
        : type === "warning"
          ? "bg-muted border-line"
          : type === "error"
            ? "bg-red-500/10 border-red-500/20"
            : "bg-muted border-line";
    return (
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border ${tone}`}
      >
        {alertMeta[type].icon}
      </span>
    );
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt, alert }}>
      {children}
      <Modal
        open={!!state}
        onClose={() =>
          finish(
            state?.kind === "confirm"
              ? false
              : state?.kind === "prompt"
                ? null
                : undefined,
          )
        }
        size="sm"
        srTitle={state?.title}
        onKeyDown={(e) => {
          if (e.key === "Enter" && state) {
            e.preventDefault();
            if (state.kind === "prompt") finish(value);
            else if (state.kind === "confirm") finish(true);
            else finish();
          }
        }}
      >
        {state ? (
          <>
            <ModalHeader
              title={state.title}
              icon={
                state.kind === "alert" && state.type
                  ? iconWrap(state.type)
                  : undefined
              }
            />
            <ModalBody>
              <p className="text-xs text-fg-secondary leading-relaxed">
                {state.message}
              </p>
              {state.kind === "prompt" ? (
                <Input
                  autoFocus
                  value={value}
                  placeholder={state.placeholder}
                  onChange={(e) => setValue(e.target.value)}
                  className="focus:ring-1 focus:ring-line-strong"
                />
              ) : null}
              <ModalFooter>
                {state.kind !== "alert" ? (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      finish(state.kind === "prompt" ? null : false)
                    }
                  >
                    {state.cancelText}
                  </Button>
                ) : null}
                <Button
                  variant={state.destructive ? "destructive" : "primary"}
                  onClick={() => {
                    if (state.kind === "prompt") finish(value);
                    else if (state.kind === "confirm") finish(true);
                    else finish();
                  }}
                >
                  {state.confirmText}
                </Button>
              </ModalFooter>
            </ModalBody>
          </>
        ) : null}
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}
