import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "uos.plugin-connectors",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Plugin Connectors",
  description: "Paperclip connector plugin for Composio, GetXAPI, and runtime policy.",
  author: "turmo.dev",
  categories: ["connector"],
  capabilities: [
    "events.subscribe",
    "plugin.state.read",
    "plugin.state.write",
    "ui.dashboardWidget.register",
  ],
  entrypoints: {
    worker: './dist/worker.js',
    ui: './dist/ui'
  },
  ui: {
    slots: [
      {
        type: "dashboardWidget",
        id: "health-widget",
        displayName: "Plugin Connectors Health",
        exportName: "DashboardWidget"
      }
    ]
  }
};

export default manifest;
