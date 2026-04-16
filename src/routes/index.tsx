import { createFileRoute } from '@tanstack/react-router'
import DiagramCreator from '../components/DiagramCreator'

export const Route = createFileRoute('/')({
  component: DiagramCreator,
})
