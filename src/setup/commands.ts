/** Anthropic's documented macOS install line (https://code.claude.com/docs/en/setup). The app only shows and copies it. */
export const INSTALL_COMMAND = "curl -fsSL https://claude.ai/install.sh | bash";
/** The CLI's own sign-in; the user runs it in Terminal, the app never sees the credentials. */
export const LOGIN_COMMAND = "claude auth login";
export const INSTALL_DOCS_URL = "https://code.claude.com/docs/en/setup";
export const PLANS_URL = "https://claude.com/pricing";
