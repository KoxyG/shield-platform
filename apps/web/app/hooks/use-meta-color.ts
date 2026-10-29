// shadcn/ui's useMetaColor (ui.shadcn.com, apps/v4/hooks/use-meta-color.ts), with
// one change: instead of two hardcoded hex values, the color is the theme's own
// --background from packages/ui's globals.css, so the browser UI always matches it.
import * as React from "react"
import { useTheme } from "next-themes"

export function useMetaColor() {
  const { resolvedTheme } = useTheme()
  const [metaColor, setMetaColorState] = React.useState("")

  React.useEffect(() => {
    // Next frame: by then next-themes has put the theme's class on <html>
    const frame = requestAnimationFrame(() =>
      setMetaColorState(
        getComputedStyle(document.documentElement)
          .getPropertyValue("--background")
          .trim()
      )
    )
    return () => cancelAnimationFrame(frame)
  }, [resolvedTheme])

  const setMetaColor = React.useCallback((color: string) => {
    if (!color) return
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", color)
  }, [])

  return {
    metaColor,
    setMetaColor,
  }
}
