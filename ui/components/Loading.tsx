import { Component } from "solid-js";

interface LoadingProps {
  message?: string;
}

const Loading: Component<LoadingProps> = (props) => {
  return (
    <div class="loading-container">
      <div class="loading-spinner" />
      <p class="loading-text">{props.message ?? "Loading..."}</p>
    </div>
  );
};

export default Loading;
