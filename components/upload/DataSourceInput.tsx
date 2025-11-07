// components/DataSourceInput.tsx
import React from "react";
import { Card } from "@/components/ui/card";
import { DataSet, DataSourceType } from "@/lib/types";
import { CsvHandler } from "@/components/upload/CSVHandler";
import { ExcelHandler } from "@/components/upload/ExcelHandler";
import { SheetsHandler } from "@/components/upload/SheetsHandler";
import {
  JsonHandler,
  TextPdfHandler,
  DatabaseHandler,
  RedditHandler,
  AdSenseHandler,
} from "@/components/upload/OtherHandlers";
import {
  SQLiteHandler,
  PostgresHandler,
  MySQLHandler,
} from "@/components/upload/SQLHandlers";

type DataSourceInputProps = {
  source: DataSourceType;
  onDataLoaded: (ds: DataSet) => void;
  onError: (err: string) => void;
  onUriLoaded: (uri: string, type: string) => void;
  userInfo: any;
};

export const DataSourceInput: React.FC<DataSourceInputProps> = ({
  source,
  onDataLoaded,
  onError,
  onUriLoaded,
  userInfo,
}) => {
  const props = { onDataLoaded, onError };
  const sqlprops = { onUriLoaded: onUriLoaded, onError };

  const isSQLSource = ["postgresql", "mysql", "sqlite"].includes(source);

  const existingConnection =
    isSQLSource && userInfo
      ? (() => {
          switch (source) {
            case "postgresql":
              return userInfo.postgres_db_url;
            case "mysql":
              return userInfo.mysql_db_url;
            case "sqlite":
              return userInfo.sqlite_db_url;
            default:
              return null;
          }
        })()
      : null;

  if (isSQLSource && existingConnection) {
    return null;
  }

  switch (source) {
    case "csv":
      return <CsvHandler {...props} />;
    case "excel":
      return <ExcelHandler {...props} />;
    case "sheets":
      return <SheetsHandler {...props} />;
    case "json":
      return <JsonHandler {...props} />;
    case "text":
    case "pdf":
      return <TextPdfHandler {...props} type={source} />;
    case "postgresql":
      return <PostgresHandler {...sqlprops} dbType="postgresql" />;
    case "mysql":
      return <MySQLHandler {...sqlprops} dbType="mysql" />;
    case "sqlite":
      return <SQLiteHandler {...sqlprops} dbType="sqlite" />;
    case "mongodb":
      return <DatabaseHandler {...props} dbType={source} />;
    case "reddit":
      return <RedditHandler {...props} />;
    case "adsense":
      return <AdSenseHandler {...props} />;
    default:
      return <Card className="p-6">Select a data source to begin</Card>;
  }
};
