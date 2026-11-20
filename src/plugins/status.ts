// Contribution services observe readiness without access to plugin management.
declare module "@deepseek-ai/cordis" {
  interface Context {
    pluginStatus: {
      isActive(id: string, revision: string): boolean;
      subscribe(listener: () => void): () => void;
      /** Whether startup is over: the plugin settings are read, or need the
       * user, and no plugin is still starting. Without it, startup is over. */
      settled?(): boolean;
      /** Like `settled`, for bundled plugins only: the plugin settings are
       * read, or need the user, and no bundled plugin is still starting. */
      bundledSettled?(): boolean;
    };
  }
}
export {};
