import { Component } from "react";
import { Brand, Button } from "../ui";
import { isWorkflowBusy } from "../../pwa/state";

export default class PwaErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="pwa-connection-screen">
        <Brand />
        <section className="panel">
          <h1>Let’s get your workspace up to date.</h1>
          <p>The page could not load. Save any work in other tabs, then refresh to try again.</p>
          <Button onClick={() => !isWorkflowBusy() && window.location.reload()}>
            Refresh page
          </Button>
        </section>
      </main>
    );
  }
}
