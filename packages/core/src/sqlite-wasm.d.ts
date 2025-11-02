declare module "@sqlite.org/sqlite-wasm" {
  export type MessageType =
    | "open"
    | "exec"
    | "close"
    | "export"
    | "transaction"
    | "config-get";

  export type Message = {
    type: MessageType;
    messageId?: string;
    args?: any;
    dbId?: string;
    sql?: string;
    bind?: any[];
    returnValue?: string;
    filename?: string;
  };

  export type Response = {
    type: "error" | string;
    messageId?: string;
    dbId?: string;
    result?: {
      message?: string;
      resultRows?: any[];
      dbId?: string;
    };
  };

  export type WorkerAPI = (
    type: MessageType,
    args?: any
  ) => Promise<Response>;

  export function sqlite3Worker1Promiser(config: {
    onready?: () => void;
  }): WorkerAPI;
}
