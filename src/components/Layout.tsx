import React, { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { ToastContainer } from "./ToastContainer";
import { PWAInstallButton } from "./PWAInstallButton";
import { OfflineIndicator } from "./OfflineIndicator";
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "./ui";

interface UserProfile {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  user?: UserProfile | null;
  authChecking?: boolean;
  isLoggingIn?: boolean;
  isUserMenuOpen?: boolean;
  onUserMenuToggle?: () => void;
  onSignIn?: () => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
  isAdmin?: boolean;
  rightHeaderActions?: ReactNode;
  leftHeaderActions?: ReactNode;
  containerClassName?: string;
}

export const Layout = ({
  children,
  user,
  authChecking = false,
  isLoggingIn = false,
  isUserMenuOpen,
  onUserMenuToggle,
  onSignIn,
  onSignOut,
  isAdmin,
  rightHeaderActions,
  leftHeaderActions,
  containerClassName = "max-w-7xl mx-auto px-7 pt-4 pb-10",
  className = "",
  ...props
}: LayoutProps) => {
  return (
    <div
      className={`min-h-screen text-fg font-sans selection:bg-muted ${className}`}
      {...props}
    >
      <header className="sticky top-0 z-40 bg-transparent">
        <div className="max-w-7xl mx-auto px-7 pt-8 pb-3 flex items-center justify-between">
          <div className="flex items-center justify-start min-w-0">
            <Link
              to="/"
              className="hover:opacity-80 transition-opacity flex items-center shrink-0"
            >
              <Logo className="h-4 w-auto text-fg shrink-0" />
            </Link>
            {leftHeaderActions}
          </div>

          <div className="flex items-center justify-end gap-3 sm:gap-4 flex-1">
            <PWAInstallButton />
            {rightHeaderActions}

            {authChecking ? (
              <Loader2 className="w-4 h-4 text-fg-muted animate-spin" />
            ) : user ? (
              <Menu>
                <MenuTrigger asChild>
                  <button
                    title={user.email || "Menu do usuário"}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-7 h-7 rounded-full border border-line object-cover"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-muted border border-line text-meta font-semibold text-fg-default inline-flex items-center justify-center">
                        {user.displayName?.charAt(0).toUpperCase() ||
                          user.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </span>
                    )}
                  </button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuLabel>{user.email || user.displayName}</MenuLabel>
                  <MenuSeparator />
                  <MenuItem
                    danger
                    icon={<LogOut />}
                    onSelect={() => onSignOut?.()}
                  >
                    Sair
                  </MenuItem>
                </MenuContent>
              </Menu>
            ) : (
              <Button size="toolbar" onClick={onSignIn} disabled={isLoggingIn}>
                {isLoggingIn ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                <span>Fazer Login</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className={containerClassName}>{children}</main>

      <ToastContainer />
      <OfflineIndicator />
    </div>
  );
};
