/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { easeCubic } from 'd3-ease'
import { BaseType, Selection, select as d3Select } from 'd3-selection'
import {
  D3ZoomEvent,
  ZoomBehavior,
  zoom as d3Zoom,
  zoomIdentity
} from 'd3-zoom'

import {
  ZOOM_FIT_PADDING_PERCENT,
  ZOOM_MAX_SCALE,
  ZOOM_MIN_SCALE
} from '../../../constants'
import { GraphModel } from '../../../models/Graph'
import { GraphGeometryModel } from './GraphGeometryModel'
import { GraphStyleModel } from '../../../models/GraphStyle'
import { NodeModel } from '../../../models/Node'
import { RelationshipModel } from '../../../models/Relationship'
import { isNullish } from '../../../utils/utils'
import { ForceSimulation } from './ForceSimulation'
import {
  nodeEventHandlers,
  relationshipEventHandlers
} from './mouseEventHandlers'
import {
  node as nodeRenderer,
  relationship as relationshipRenderer
} from './renderers/init'
import { nodeMenuRenderer } from './renderers/menu'
import { ZoomLimitsReached, ZoomType } from '../../../types'

type MeasureSizeFn = () => { width: number; height: number }

export class Visualization {
  private canvas: HTMLCanvasElement
  private geometry: GraphGeometryModel
  // private zoomBehavior: ZoomBehavior<SVGElement, unknown>
  private zoomMinScaleExtent: number = ZOOM_MIN_SCALE
  private callbacks: Record<
    string,
    undefined | Array<(...args: any[]) => void>
  > = {}

  forceSimulation: ForceSimulation

  // This flags that a panning is ongoing and won't trigger
  // 'canvasClick' event when panning ends.
  private draw = false
  private isZoomClick = false
  scale: number

  constructor(
    private canvasElement: HTMLCanvasElement,
    private measureSize: MeasureSizeFn,
    // onZoomEvent: (limitsReached: ZoomLimitsReached) => void,
    // onDisplayZoomWheelInfoMessage: () => void,
    private graph: GraphModel,
    public style: GraphStyleModel,
    public isFullscreen: boolean,
    public wheelZoomRequiresModKey?: boolean,
    private initialZoomToFit?: boolean
  ) {
    this.isFullscreen = isFullscreen
    this.wheelZoomRequiresModKey = wheelZoomRequiresModKey

    this.canvas = canvasElement
    this.geometry = new GraphGeometryModel(style)
    this.scale = 1

    this.forceSimulation = new ForceSimulation(this.render.bind(this))
  }

  private render() {
    this.geometry.onTick(this.graph)
    const canvasWidth = this.canvas.width
    const canvasHeight = this.canvas.height
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      console.error('null ctx')
      return
    }

    ctx.resetTransform()
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    ctx.translate(canvasWidth / 2, canvasHeight / 2)
    ctx.scale(this.scale, this.scale)
    this.graph.nodes().forEach(node => this.drawNode(ctx, node))
  }

  private updateNodes() {
    const nodes = this.graph.nodes()
    this.geometry.onGraphChange(this.graph, {
      updateNodes: true,
      updateRelationships: false
    })

    this.forceSimulation.updateNodes(this.graph)
    this.forceSimulation.updateRelationships(this.graph)
  }

  drawNode(ctx: CanvasRenderingContext2D, node: NodeModel) {
    ctx.beginPath()
    ctx.arc(node.x, node.y, 50, 0, Math.PI * 2)
    ctx.fillStyle = 'blue'
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'white'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Node', node.x, node.y, 50)
  }

  private updateRelationships() {
    const relationships = this.graph.relationships()
    this.geometry.onGraphChange(this.graph, {
      updateNodes: false,
      updateRelationships: true
    })

    // relationshipRenderer.forEach(renderer =>
    //   relationshipGroups.call(renderer.onGraphChange, this)
    // )

    this.forceSimulation.updateRelationships(this.graph)
    // The onGraphChange handler does only repaint relationship color
    // not width and caption, since it requires taking into account surrounding data
    // since the arrows have different bending depending on how the nodes are
    // connected. We work around that by doing an additional full render to get the
    // new stylings
    this.render()
  }

  zoomByType = (zoomType: ZoomType): void => {
    this.draw = true
    this.isZoomClick = true
    zoomType

    if (zoomType === ZoomType.IN) {
    } else if (zoomType === ZoomType.OUT) {
    } else if (zoomType === ZoomType.FIT) {
      this.zoomToFitViewport()
      this.adjustZoomMinScaleExtentToFitGraph(1)
    }
  }

  private zoomToFitViewport = () => {
    this.scale = this.getZoomScaleFactorToFitWholeGraph()
    this.render()
  }

  private getZoomScaleFactorToFitWholeGraph(): number {
    const canvasWidth = this.canvasElement.width
    const canvasHeight = this.canvasElement.height

    if (canvasWidth === 0 || canvasHeight === 0) {
      return 1.0
    }

    const graphBBox = this.graph.getBoundingBox()
    const graphWidth = graphBBox.width + 120
    const graphHeight = graphBBox.height + 120

    const widthRatio = graphWidth > canvasWidth ? canvasWidth / graphWidth : 1
    const heightRatio =
      graphHeight > canvasHeight ? canvasHeight / graphHeight : 1

    return Math.min(widthRatio, heightRatio)
  }

  private adjustZoomMinScaleExtentToFitGraph = (
    padding_factor = 0.75
  ): void => {
    padding_factor
    // const scaleAndOffset = this.getZoomScaleFactorToFitWholeGraph()
    // const scaleToFitGraphWithPadding = scaleAndOffset
    //   ? scaleAndOffset.scale * padding_factor
    //   : this.zoomMinScaleExtent
    // if (scaleToFitGraphWithPadding <= this.zoomMinScaleExtent) {
    //   // this.zoomMinScaleExtent = scaleToFitGraphWithPadding
    //   // this.zoomBehavior.scaleExtent([
    //   //   scaleToFitGraphWithPadding,
    //   //   ZOOM_MAX_SCALE
    //   // ])
    // }
  }

  on = (event: string, callback: (...args: any[]) => void): this => {
    if (isNullish(this.callbacks[event])) {
      this.callbacks[event] = []
    }

    this.callbacks[event]?.push(callback)
    return this
  }

  trigger = (event: string, ...args: any[]): void => {
    const callbacksForEvent = this.callbacks[event] ?? []
    callbacksForEvent.forEach(callback => callback.apply(null, args))
  }

  init(): void {
    this.updateNodes()
    this.updateRelationships()

    this.adjustZoomMinScaleExtentToFitGraph()
    this.setInitialZoom()
  }

  setInitialZoom(): void {
    const count = this.graph.nodes().length

    // chosen by *feel* (graph fitting guesstimate)
    const scale = -0.02364554 + 1.913 / (1 + (count / 12.7211) ** 0.8156444)
    // this.zoomBehavior.scaleBy(this.root, Math.max(0, scale))
  }

  precomputeAndStart(): void {
    this.forceSimulation.precomputeAndStart(
      () => this.initialZoomToFit && this.zoomByType(ZoomType.FIT)
    )
  }

  update(options: {
    updateNodes: boolean
    updateRelationships: boolean
    restartSimulation?: boolean
  }): void {
    if (options.updateNodes) {
      this.updateNodes()
    }

    if (options.updateRelationships) {
      this.updateRelationships()
    }

    if (options.restartSimulation ?? true) {
      this.forceSimulation.restart()
    }
    this.trigger('updated')
  }

  resize(isFullscreen: boolean, wheelZoomRequiresModKey: boolean): void {
    const size = this.measureSize()
    this.isFullscreen = isFullscreen
    this.wheelZoomRequiresModKey = wheelZoomRequiresModKey

    // this.rect
    //   .attr('x', () => -Math.floor(size.width / 2))
    //   .attr('y', () => -Math.floor(size.height / 2))

    // this.root.attr(
    //   'viewBox',
    //   [
    //     -Math.floor(size.width / 2),
    //     -Math.floor(size.height / 2),
    //     size.width,
    //     size.height
    //   ].join(' ')
    // )
  }
}
