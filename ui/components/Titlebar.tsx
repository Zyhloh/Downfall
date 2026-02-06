import { Component } from "solid-js";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { VsChevronDown, VsChromeClose } from "solid-icons/vs";
import { minimizeToTray } from "@src/ipc/commands";
import logoImg from "../assets/downfall.png";

interface TitlebarProps {
  minimizeOnClose?: boolean;
}

const Titlebar: Component<TitlebarProps> = (props) => {
  const appWindow = getCurrentWindow();

  const close = () => {
    if (props.minimizeOnClose) {
      minimizeToTray().catch(() => appWindow.close());
    } else {
      appWindow.close();
    }
  };
  const minimize = () => appWindow.minimize();
  const startDrag = () => appWindow.startDragging();
  const stopProp = (e: MouseEvent) => e.stopPropagation();

  return (
    <div class="titlebar" onMouseDown={startDrag}>
      <div class="titlebar-brand">
        <img src={logoImg} class="titlebar-logo" alt="" />
        <span class="titlebar-title">Downfall</span>
      </div>
      <div class="titlebar-controls" onMouseDown={stopProp}>
        <button class="titlebar-btn" onClick={minimize} title="Minimize">
          <VsChevronDown size={14} />
        </button>
        <button class="titlebar-btn titlebar-btn-close" onClick={close} title="Close">
          <VsChromeClose size={14} />
        </button>
      </div>
    </div>
  );
};

export default Titlebar;
