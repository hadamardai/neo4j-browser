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
import React from 'react'

import {
  BasicNode,
  BasicRelationship,
  ZoomInIcon,
  ZoomOutIcon,
  ZoomToFitIcon
} from '../../../common'

import { GraphModel } from '../../models/Graph'
import {
  GraphEventHandlerModel,
  GraphInteractionCallBack
} from './GraphEventHandlerModel'
import { GraphStyleModel } from '../../models/GraphStyle'
import {
  GetNodeNeighboursFn,
  VizItem,
  ZoomLimitsReached,
  ZoomType
} from '../../types'
import {
  GraphStats,
  createGraph,
  getGraphStats,
  mapRelationships
} from '../../utils/mapper'
import { WheelZoomInfoOverlay } from './WheelZoomInfoOverlay'
import { StyledSvgWrapper, StyledZoomButton, StyledZoomHolder } from './styled'
import { ResizeObserver } from '@juggle/resize-observer'

export type GraphProps = {
  isFullscreen: boolean
  relationships: BasicRelationship[]
  nodes: BasicNode[]
  getNodeNeighbours: GetNodeNeighboursFn
  onItemMouseOver: (item: VizItem) => void
  onItemSelect: (item: VizItem) => void
  graphStyle: GraphStyleModel
  styleVersion: number
  onGraphModelChange: (stats: GraphStats) => void
  assignVisElement: (svgElement: any, graphElement: any) => void
  autocompleteRelationships: boolean
  getAutoCompleteCallback: (
    callback: (
      internalRelationships: BasicRelationship[],
      initialRun: boolean
    ) => void
  ) => void
  setGraph: (graph: GraphModel) => void
  offset: number
  wheelZoomRequiresModKey?: boolean
  wheelZoomInfoMessageEnabled?: boolean
  disableWheelZoomInfoMessage: () => void
  initialZoomToFit?: boolean
  onGraphInteraction?: GraphInteractionCallBack
}

type GraphState = {
  zoomInLimitReached: boolean
  zoomOutLimitReached: boolean
  displayingWheelZoomInfoMessage: boolean
  zoomLevel: number
}

export class Graph extends React.Component<GraphProps, GraphState> {
  canvasElement: React.RefObject<HTMLCanvasElement>
  wrapperElement: React.RefObject<HTMLDivElement>
  wrapperResizeObserver: ResizeObserver

  constructor(props: GraphProps) {
    super(props)
    this.state = {
      zoomInLimitReached: false,
      zoomOutLimitReached: false,
      displayingWheelZoomInfoMessage: false,
      zoomLevel: 1
    }
    this.canvasElement = React.createRef()
    this.wrapperElement = React.createRef()

    this.wrapperResizeObserver = new ResizeObserver(() => {
      // this.visualization?.resize(
      //   this.props.isFullscreen,
      //   !!this.props.wheelZoomRequiresModKey
      // )
    })
  }

  componentDidMount(): void {
    const {
      assignVisElement,
      autocompleteRelationships,
      getAutoCompleteCallback,
      getNodeNeighbours,
      graphStyle,
      initialZoomToFit,
      isFullscreen,
      nodes,
      onGraphInteraction,
      onGraphModelChange,
      onItemMouseOver,
      onItemSelect,
      relationships,
      setGraph,
      wheelZoomRequiresModKey
    } = this.props

    if (!this.canvasElement.current) return

    const measureSize = () => ({
      width: this.canvasElement.current?.parentElement?.clientWidth ?? 200,
      height: this.canvasElement.current?.parentElement?.clientHeight ?? 200
    })

    const graph = createGraph(nodes, relationships)

    const graphEventHandler = new GraphEventHandlerModel(
      graph,
      getNodeNeighbours,
      onItemMouseOver,
      onItemSelect,
      onGraphModelChange,
      onGraphInteraction
    )
    graphEventHandler.bindEventHandlers()

    onGraphModelChange(getGraphStats(graph))
    // this.visualization.resize(isFullscreen, !!wheelZoomRequiresModKey)

    if (setGraph) {
      setGraph(graph)
    }
    if (autocompleteRelationships) {
      getAutoCompleteCallback(
        (internalRelationships: BasicRelationship[], initialRun: boolean) => {
          if (initialRun) {
            // this.visualization?.init()
            graph.addInternalRelationships(
              mapRelationships(internalRelationships, graph)
            )
            onGraphModelChange(getGraphStats(graph))
            // this.visualization?.update({
            //   updateNodes: false,
            //   updateRelationships: true,
            //   restartSimulation: false
            // })
            // this.visualization?.precomputeAndStart()
            graphEventHandler.onItemMouseOut()
          } else {
            graph.addInternalRelationships(
              mapRelationships(internalRelationships, graph)
            )
            onGraphModelChange(getGraphStats(graph))
            // this.visualization?.update({
            //   updateNodes: false,
            //   updateRelationships: true,
            //   restartSimulation: false
            // })
          }
        }
      )
    } else {
      // this.visualization?.init()
      // this.visualization?.precomputeAndStart()
    }
    // if (assignVisElement) {
    //   // assignVisElement(this.canvasElement.current, this.visualization)
    // }

    this.wrapperResizeObserver.observe(this.canvasElement.current)
  }

  componentDidUpdate(prevProps: GraphProps): void {
    this.updateGraphCanvas()
    if (this.props.isFullscreen !== prevProps.isFullscreen) {
      // this.visualization?.resize(
      //   this.props.isFullscreen,
      //   !!this.props.wheelZoomRequiresModKey
      // )
    }

    if (this.props.styleVersion !== prevProps.styleVersion) {
      // this.visualization?.update({
      //   updateNodes: true,
      //   updateRelationships: true,
      //   restartSimulation: false
      // })
    }
  }

  componentWillUnmount(): void {
    this.wrapperResizeObserver.disconnect()
  }

  handleZoomEvent = (limitsReached: ZoomLimitsReached): void => {
    if (
      limitsReached.zoomInLimitReached !== this.state.zoomInLimitReached ||
      limitsReached.zoomOutLimitReached !== this.state.zoomOutLimitReached
    ) {
      this.setState({
        zoomInLimitReached: limitsReached.zoomInLimitReached,
        zoomOutLimitReached: limitsReached.zoomOutLimitReached
      })
    }
  }

  handleDisplayZoomWheelInfoMessage = (): void => {
    if (
      !this.state.displayingWheelZoomInfoMessage &&
      this.props.wheelZoomRequiresModKey &&
      this.props.wheelZoomInfoMessageEnabled
    ) {
      this.displayZoomWheelInfoMessage(true)
    }
  }

  displayZoomWheelInfoMessage = (display: boolean): void => {
    this.setState({ displayingWheelZoomInfoMessage: display })
  }

  zoomInClicked = (): void => {
    console.log('in')
    this.zoomByType(ZoomType.IN)
  }

  zoomOutClicked = (): void => {
    console.log('out')
    this.zoomByType(ZoomType.OUT)
  }

  zoomToFitClicked = (): void => {
    this.zoomByType(ZoomType.FIT)
  }

  zoomByType = (zoomType: ZoomType): void => {
    if (zoomType === ZoomType.IN) {
      this.setState((state, _) => ({
        zoomLevel: state.zoomLevel + 0.3
      }))
    } else if (zoomType === ZoomType.OUT) {
      this.setState((state, _) => ({
        zoomLevel: state.zoomLevel - 0.3
      }))
    } else if (zoomType === ZoomType.FIT) {
      this.setState({ zoomLevel: 1 })
      // this.zoomToFitViewport()
      // this.adjustZoomMinScaleExtentToFitGraph(1)
    }
  }

  updateGraphCanvas() {
    const canvas = this.canvasElement.current
    if (!canvas) {
      console.error('null canvas')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('null canvas 2d context')
      return
    }
    console.log('draw')

    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(this.state.zoomLevel, this.state.zoomLevel)
    console.log(this.state.zoomLevel)
    for (const [idx, node] of this.props.nodes.entries()) {
      const label = node.labels[0]
      const property = label ? node.properties[label] : 'NULL'
      this.drawNode(ctx, property, idx * 100, 100, 50)
    }

    ctx.restore()
  }

  drawNode(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number,
    radius: number
  ): void {
    ctx.beginPath()

    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'blue'
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'white'
    ctx.font = '20px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, x, y, radius)
  }

  render(): JSX.Element {
    const {
      offset,
      isFullscreen,
      wheelZoomInfoMessageEnabled,
      disableWheelZoomInfoMessage
    } = this.props
    const {
      zoomInLimitReached,
      zoomOutLimitReached,
      displayingWheelZoomInfoMessage
    } = this.state

    return (
      <StyledSvgWrapper ref={this.wrapperElement}>
        <canvas
          ref={this.canvasElement}
          width={this.wrapperElement.current?.offsetWidth ?? 100}
          height={this.wrapperElement.current?.offsetHeight ?? 100}
        />
        <StyledZoomHolder offset={offset} isFullscreen={isFullscreen}>
          <StyledZoomButton
            aria-label={'zoom-in'}
            className={'zoom-in'}
            disabled={zoomInLimitReached}
            onClick={this.zoomInClicked}
          >
            <ZoomInIcon large={isFullscreen} />
          </StyledZoomButton>
          <StyledZoomButton
            aria-label={'zoom-out'}
            className={'zoom-out'}
            disabled={zoomOutLimitReached}
            onClick={this.zoomOutClicked}
          >
            <ZoomOutIcon large={isFullscreen} />
          </StyledZoomButton>
          <StyledZoomButton
            aria-label={'zoom-to-fit'}
            onClick={this.zoomToFitClicked}
          >
            <ZoomToFitIcon large={isFullscreen} />
          </StyledZoomButton>
        </StyledZoomHolder>
        {wheelZoomInfoMessageEnabled && displayingWheelZoomInfoMessage && (
          <WheelZoomInfoOverlay
            onDisableWheelZoomInfoMessage={disableWheelZoomInfoMessage}
          />
        )}
      </StyledSvgWrapper>
    )
  }
}
