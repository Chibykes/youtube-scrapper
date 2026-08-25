/** listclean's per-email verdict. See https://api.listclean.xyz. */
export type ListCleanVerdict = "clean" | "dirty" | "unknown" | "error";

/** Raw per-email record — the shape of one item from GET /verify/email/{email} and GET /downloads/json/{list_id}/{type}. */
export type ListCleanEmailRecord = ListCleanDownloadData["result"][number];

export type ListCleanJobStatus = "SUBMITTED" | "INPROCESS" | "COMPLETED";

/** GET /lists/{list_id} response data. */
export type ListCleanListInfo = {
  list_id: number;
  filename: string;
  request_time: string;
  status: ListCleanJobStatus;
  upload_id: string;
  size_in_bytes: number;
  size_for_human: string;
  allow_download: number;
  analytics: {
    summary: {
      total: string;
      duplicate: number;
      dirty: {
        count: number;
        perc: number;
      };
      clean: {
        count: number;
        perc: number;
      };
      unknown: {
        count: number;
        perc: number;
      };
    };
    dirty_summary: [
      {
        count: number;
        perc: number;
        dirty_type: string;
      }
    ];
    clean_summary: [
      {
        count: number;
        perc: number;
        clean_type: string;
      }
    ];
  };
  cost: {
    rate: {
      INR: number;
      USD: number;
    };
    cost: {
      INR: number;
      USD: number;
    };
  };
};

export type ListCleanEnvelope<T> = {
  success: 0 | 1;
  message: string;
  error_code?: number;
  data: T;
};

/**
 * GET /downloads/json/{list_id}/{type} wraps its payload in a second,
 * undocumented envelope on top of the usual one — verified against a live
 * response, not just the (looser) published spec. So the full response is
 * ListCleanEnvelope<ListCleanEnvelope<ListCleanDownloadData>>.
 */
export type ListCleanDownloadData = {
  queue_name: string;
  type: string;
  sub_type: string;
  total: number;
  result: {
    email: string;
    status: ListCleanVerdict;
    reason_code: string;
    reason: string;
    mx: string;
    msp: string;
    attributes: {
      EMAIL: string;
    };
  }[];
};

export type EmailStatus = "valid" | "invalid" | "unknown";

/** Our own valid/invalid/unknown verdict, derived from listclean's raw status. */
export type ListCleanResult = {
  email: string;
  status: EmailStatus;
  verdict: ListCleanVerdict;
  reason: string;
};
