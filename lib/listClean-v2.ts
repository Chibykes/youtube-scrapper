// Type definitions for listclean API v2

export type EmailStatus = "clean" | "dirty" | "unknown" | "error";
export type EmailBatchResponse = {
  success: number;
  error_code: number;
  message: string;
  data: {
    list_id: number;
  };
};

export type GetListByListIdResponse = {
  success: number;
  message: string;
  error_code: number;
  data: [
    {
      list_id: number;
      filename: string;
      size_in_bytes: number;
      request_time: string;
      status: string;
      upload_id: string;
      analytics: {
        summary: {
          total: number;
          duplicate: number;
          dirty: {
            count: number;
            perc: number;
          };
          clean: {
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
    }
  ];
};

export type DownloadJSONListTypeResponse = {
  success: number;
  error_code: number;
  message: string;
  data: {
    success: number;
    message: string;
    error_code: number;
    data: {
      queue_name: string;
      type: string;
      sub_type: string;
      total: number;
      result: [
        {
          email: string;
          status: EmailStatus;
          reason_code: string;
          reason: string;
          mx: string;
          msp: string;
          attributes: {
            EMAIL: string;
          };
        }
      ];
    };
  };
};