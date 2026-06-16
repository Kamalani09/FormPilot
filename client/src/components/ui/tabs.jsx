import * as React from 'react';
import { cn } from '../../lib/utils';

function Tabs({ className, ...props }) {
  return <div className={cn('w-full', className)} {...props} />;
}

function TabsList({ className, ...props }) {
  return (
    <div
      className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, active, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        active && 'bg-background text-foreground shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }) {
  return <div className={cn('mt-4', className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
