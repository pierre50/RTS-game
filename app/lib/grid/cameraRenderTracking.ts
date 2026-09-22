import type { RenderableInstance } from './visibility'

/** Remove temporarily hidden entities until their next placement/visibility update. */
export function forgetInstanceRenderCandidate(instance: RenderableInstance): void {
  instance.context?.controls?.cameraController?.trackRenderCandidate(instance, null)
}
