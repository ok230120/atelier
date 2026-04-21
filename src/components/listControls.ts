export const listControlFieldClassName =
  'h-11 w-full appearance-none rounded-xl border border-border bg-bg-panel pl-10 pr-9 text-sm text-text-main shadow-sm transition-all duration-200 cursor-pointer focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50';

export const listControlIconClassName =
  'pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-base text-text-dim';

export const listControlButtonClassName =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-bg-panel px-4 text-sm text-text-muted transition-colors hover:text-text-main hover:border-accent/50';

export const listControlCompactButtonClassName =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-bg-panel px-3 text-xs text-text-muted transition-colors hover:text-text-main hover:border-accent/50';

export const listControlWidthClassNames = {
  folder: 'w-full min-w-[11rem] sm:min-w-[12rem] xl:w-auto',
  sort: 'w-full min-w-[8.5rem] sm:min-w-[9.5rem] xl:w-auto',
  duration: 'w-full min-w-[7rem] sm:min-w-[8rem] xl:w-auto',
  pageSize: 'w-full min-w-[5.25rem] xl:w-auto',
  search: 'w-full min-w-[12rem] flex-1 xl:w-auto',
  tagButton: 'min-w-[5rem] shrink-0 xl:w-auto',
} as const;
