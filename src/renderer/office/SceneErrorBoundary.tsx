import { Component, type ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  onError: (error: unknown) => void
  children: ReactNode
}

// R3F rethrows WebGL context failures during render; this turns them into the List view fallback.
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { hasFailed: boolean }> {
  state = { hasFailed: false }

  static getDerivedStateFromError(): { hasFailed: boolean } {
    return { hasFailed: true }
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error)
  }

  render(): ReactNode {
    return this.state.hasFailed ? null : this.props.children
  }
}
