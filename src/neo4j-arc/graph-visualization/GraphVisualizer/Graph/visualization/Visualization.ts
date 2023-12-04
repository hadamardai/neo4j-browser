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
  private zoomBehavior: ZoomBehavior<SVGElement, unknown>
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

  constructor(
    private canvasElement: HTMLCanvasElement,
    private measureSize: MeasureSizeFn,
    onZoomEvent: (limitsReached: ZoomLimitsReached) => void,
    onDisplayZoomWheelInfoMessage: () => void,
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

    this.zoomBehavior = d3Zoom<SVGElement, unknown>()
      .scaleExtent([this.zoomMinScaleExtent, ZOOM_MAX_SCALE])
      .on('zoom', (e: D3ZoomEvent<SVGElement, unknown>) => {
        const isZoomClick = this.isZoomClick
        this.draw = true
        this.isZoomClick = false

        const currentZoomScale = e.transform.k
        const limitsReached: ZoomLimitsReached = {
          zoomInLimitReached: currentZoomScale >= ZOOM_MAX_SCALE,
          zoomOutLimitReached: currentZoomScale <= this.zoomMinScaleExtent
        }
        onZoomEvent(limitsReached)
      })
      // This is the default implementation of wheelDelta function in d3-zoom v3.0.0
      // For some reasons typescript complains when trying to get it by calling zoomBehaviour.wheelDelta() instead
      // but it should be the same (and indeed it works at runtime).
      // https://github.com/d3/d3-zoom/blob/1bccd3fd56ea24e9658bd7e7c24e9b89410c8967/README.md#zoom_wheelDelta
      // Keps the zoom behavior constant for metam ctrl and shift key. Otherwise scrolling is faster with ctrl key.
      .wheelDelta(
        e => -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002)
      )
      .filter(e => {
        if (e.type === 'wheel') {
          const modKeySelected = e.metaKey || e.ctrlKey || e.shiftKey
          if (this.wheelZoomRequiresModKey && !modKeySelected) {
            onDisplayZoomWheelInfoMessage()
            return false
          }
        }
        return true
      })

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

    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    const xOffset = canvasWidth / 2
    const yOffset = canvasHeight / 2
    this.graph
      .nodes()
      .forEach(node => this.drawNode(ctx, node, xOffset, yOffset))
  }

  private updateNodes() {
    const nodes = this.graph.nodes()
    this.geometry.onGraphChange(this.graph, {
      updateNodes: true,
      updateRelationships: false
    })

    // nodeRenderer.forEach(renderer =>
    //   nodeGroups.call(renderer.onGraphChange, this)
    // )

    // nodeMenuRenderer.forEach(renderer =>
    //   nodeGroups.call(renderer.onGraphChange, this)
    // )

    this.forceSimulation.updateNodes(this.graph)
    this.forceSimulation.updateRelationships(this.graph)
  }

  drawNode(
    ctx: CanvasRenderingContext2D,
    node: NodeModel,
    xOffset: number,
    yOffset: number
  ) {
    const centerX = node.x + xOffset
    const centerY = node.y + yOffset
    ctx.beginPath()
    ctx.arc(centerX, centerY, 50, 0, Math.PI * 2)
    ctx.fillStyle = 'blue'
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'white'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Node', centerX, centerY, 50)
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

    // if (zoomType === ZoomType.IN) {
    //   this.zoomBehavior.scaleBy(this.root, 1.3)
    // } else if (zoomType === ZoomType.OUT) {
    //   this.zoomBehavior.scaleBy(this.root, 0.7)
    // } else if (zoomType === ZoomType.FIT) {
    //   this.zoomToFitViewport()
    //   this.adjustZoomMinScaleExtentToFitGraph(1)
    // }
  }

  private zoomToFitViewport = () => {
    const scaleAndOffset = this.getZoomScaleFactorToFitWholeGraph()
    if (scaleAndOffset) {
      const { scale, centerPointOffset } = scaleAndOffset
      // Do not zoom in more than zoom max scale for really small graphs
      // this.zoomBehavior.transform(
      //   this.root,
      //   zoomIdentity
      //     .scale(Math.min(scale, ZOOM_MAX_SCALE))
      //     .translate(centerPointOffset.x, centerPointOffset.y)
      // )
    }
  }

  private getZoomScaleFactorToFitWholeGraph = ():
    | { scale: number; centerPointOffset: { x: number; y: number } }
    | undefined => {
    const graphWidth = this.canvasElement.width
    const graphHeight = this.canvasElement.height

    const graphCenterX = graphWidth / 2
    const graphCenterY = graphHeight / 2

    if (graphWidth === 0 || graphHeight === 0) return

    const scale =
      (1 - ZOOM_FIT_PADDING_PERCENT) / Math.max(graphWidth, graphHeight)

    const centerPointOffset = { x: -graphCenterX, y: -graphCenterY }

    return { scale: scale, centerPointOffset: centerPointOffset }
  }

  private adjustZoomMinScaleExtentToFitGraph = (
    padding_factor = 0.75
  ): void => {
    const scaleAndOffset = this.getZoomScaleFactorToFitWholeGraph()
    const scaleToFitGraphWithPadding = scaleAndOffset
      ? scaleAndOffset.scale * padding_factor
      : this.zoomMinScaleExtent
    if (scaleToFitGraphWithPadding <= this.zoomMinScaleExtent) {
      this.zoomMinScaleExtent = scaleToFitGraphWithPadding
      this.zoomBehavior.scaleExtent([
        scaleToFitGraphWithPadding,
        ZOOM_MAX_SCALE
      ])
    }
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
