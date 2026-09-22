import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import {
  buttonTabsListVariants,
  buttonTabsTriggerVariants,
  type ButtonTabsVariant,
} from './button-tabs-variants';

const ButtonTabs = TabsPrimitive.Root;

const ButtonTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
    variant?: ButtonTabsVariant;
  }
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(buttonTabsListVariants({ variant }), className)}
    {...props}
  />
));
ButtonTabsList.displayName = TabsPrimitive.List.displayName;

const ButtonTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
    variant?: ButtonTabsVariant;
  }
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(buttonTabsTriggerVariants({ variant }), className)}
    {...props}
  />
));
ButtonTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const ButtonTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    {...props}
  />
));
ButtonTabsContent.displayName = TabsPrimitive.Content.displayName;

export { ButtonTabs, ButtonTabsList, ButtonTabsTrigger, ButtonTabsContent };
