# Project Notes

- Local repo dependency note: the workspace is on `Effect 4.0.0-beta.75`, so implementation should use the current `Context.Service` + `Layer.succeed` API shape rather than the older `Context.Tag` phrasing from the blueprint. The DI model remains the same Effect-style service composition.
