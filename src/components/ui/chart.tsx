"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: { CSS_SELECTOR: CSS_VALUE } }
export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: { light: string; dark: string } }
  );
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        ref={ref}
        id={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line-line]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
      payload?: unknown;
      label?: unknown;
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart();

    // Type guard for payload - recharts Tooltip props include payload and label
    type TooltipPayloadItem = {
      name?: string;
      value?: number;
      dataKey?: string;
      color?: string;
      payload?: unknown;
    };
    type TooltipPayload = Array<TooltipPayloadItem>;
    const tooltipPayload = React.useMemo(() => {
      return (payload as unknown as TooltipPayload) || [];
    }, [payload]);
    const tooltipLabelValue = label as string | number | undefined;

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !tooltipPayload?.length) {
        return null;
      }

      const [item] = tooltipPayload;
      const key = `${labelKey || item.dataKey || item.name || "value"}`;
      const itemConfig = config[key as keyof typeof config];
      const value =
        !labelKey && typeof tooltipLabelValue === "string"
          ? config[tooltipLabelValue as keyof typeof config]?.label ||
            tooltipLabelValue
          : itemConfig?.label;

      if (labelFormatter) {
        return (
          <div className={cn("font-medium", labelClassName)}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {labelFormatter(value, tooltipPayload as any)}
          </div>
        );
      }

      if (!value) {
        return null;
      }

      return <div className={cn("font-medium", labelClassName)}>{value}</div>;
    }, [
      tooltipLabelValue,
      labelFormatter,
      tooltipPayload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ]);

    if (!active || !tooltipPayload?.length) {
      return null;
    }

    const nestLabel = tooltipPayload.length === 1 && indicator !== "dot";

    return (
      <div
        ref={ref}
        className={cn(
          "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-md",
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className={cn("grid gap-1.5", nestLabel ? "gap-2" : "")}>
          {tooltipPayload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`;
            const itemConfig = config[key as keyof typeof config];
            const itemPayload = item.payload as { fill?: string } | undefined;
            const indicatorColor = color || itemPayload?.fill || item.color;

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  nestLabel ? "items-center" : "items-start"
                )}
                style={
                  {
                    "--color": indicatorColor,
                  } as React.CSSProperties
                }
              >
                {formatter && item?.value !== undefined && item.name ? (
                  // Formatter accepts flexible types from recharts
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (formatter as any)(
                    item.value,
                    item.name,
                    item as TooltipPayloadItem,
                    index,
                    itemPayload
                  )
                ) : (
                  <>
                    {!hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color] bg-[--color]",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                            "my-0.5": nestLabel && indicator === "dashed",
                          }
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        nestLabel ? "items-center" : "items-start"
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-muted-foreground">
                          {itemConfig?.label || item.name}
                        </span>
                      </div>
                      {item.value && (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {item.value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltip";

export { ChartContainer, ChartTooltip, ChartTooltipContent };
