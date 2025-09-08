'use client';

import { uiLogger } from '@/lib/logger';
import type { CustomUIDataTypes } from '@/lib/types';
import type { DataUIPart } from 'ai';
import React, { createContext, useContext, useMemo, useState } from 'react';

interface DataStreamContextValue {
  dataStream: DataUIPart<CustomUIDataTypes>[];
  setDataStream: React.Dispatch<
    React.SetStateAction<DataUIPart<CustomUIDataTypes>[]>
  >;
}

const DataStreamContext = createContext<DataStreamContextValue | null>(null);

export function DataStreamProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  uiLogger.debug({}, 'DataStreamProvider initialized');

  const [dataStream, setDataStream] = useState<DataUIPart<CustomUIDataTypes>[]>(
    [],
  );

  uiLogger.debug(
    {
      streamLength: dataStream.length,
    },
    'DataStreamProvider state updated',
  );

  const value = useMemo(() => {
    uiLogger.debug(
      {
        itemCount: dataStream.length,
      },
      'Creating DataStreamProvider context value',
    );
    return { dataStream, setDataStream };
  }, [dataStream]);

  return (
    <DataStreamContext.Provider value={value}>
      {children}
    </DataStreamContext.Provider>
  );
}

export function useDataStream() {
  const context = useContext(DataStreamContext);
  if (!context) {
    uiLogger.error({}, 'useDataStream called outside of DataStreamProvider');
    throw new Error('useDataStream must be used within a DataStreamProvider');
  }
  return context;
}
