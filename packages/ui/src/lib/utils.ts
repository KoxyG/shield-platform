import { createCn } from "cn/config"

/**
 * Merges class names like the `cn` package, but knows the theme's own scales in
 * globals.css (CDS's type scale and shadows). Without them a size such as
 * text-headline reads as a text color, and merging it drops the real color: a
 * primary button lost its white text-primary-foreground that way.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-1",
            "display-2",
            "display-3",
            "title-1",
            "title-3",
            "headline",
            "label",
            "caption",
          ],
        },
      ],
      shadow: [{ shadow: ["elevation-1", "elevation-2"] }],
    },
  },
})
