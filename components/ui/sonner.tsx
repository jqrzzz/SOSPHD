'use client'

import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:surface-card group-[.toaster]:border-border/60 group-[.toaster]:text-foreground group-[.toaster]:rounded-xl group-[.toaster]:shadow-[0_8px_24px_-8px_hsl(220_30%_2%/0.5)]',
          title: 'group-[.toast]:font-medium group-[.toast]:text-foreground',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md',
          success:
            'group-[.toaster]:border-emerald-500/30 group-[.toaster]:[&_svg]:text-emerald-400',
          error:
            'group-[.toaster]:border-destructive/30 group-[.toaster]:[&_svg]:text-destructive',
          info: 'group-[.toaster]:border-primary/30 group-[.toaster]:[&_svg]:text-primary',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
