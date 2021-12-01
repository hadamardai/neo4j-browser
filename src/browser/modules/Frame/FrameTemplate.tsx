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

import React, { useEffect, useState, useRef } from 'react'

import {
  StyledFrameBody,
  StyledFrameContents,
  StyledFrameStatusbar,
  StyledFrameMainSection,
  StyledFrameAside
} from './styled'

type FrameTemplateProps = {
  contents: JSX.Element | null | string
  onResize?: (fullscreen: boolean, collapsed: boolean, height: number) => void
  numRecords?: number
  getRecords?: () => any
  visElement?: any
  runQuery?: () => any
  sidebar?: () => JSX.Element | null
  aside?: JSX.Element | null
  statusbar?: JSX.Element | null
  removePadding?: boolean
  hasSlides?: boolean
  isFullscreen: boolean
  isCollapsed: boolean
}

function FrameTemplate({
  contents,
  onResize = () => {
    /*noop*/
  },
  sidebar,
  aside,
  statusbar,
  removePadding,
  isFullscreen,
  isCollapsed,
  hasSlides
}: FrameTemplateProps): JSX.Element {
  const [lastHeight, setLastHeight] = useState(10)
  const frameContentElementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!frameContentElementRef.current?.clientHeight) return
    const currHeight = frameContentElementRef.current.clientHeight
    if (currHeight < 300) return // No need to report a transition

    if (lastHeight !== currHeight) {
      onResize(isFullscreen, isCollapsed, currHeight)
      setLastHeight(currHeight)
    }
  }, [lastHeight, isFullscreen, isCollapsed, onResize])

  return (
    <>
      <StyledFrameBody
        fullscreen={isFullscreen}
        collapsed={isCollapsed}
        removePadding={removePadding}
        hasSlides={hasSlides}
      >
        {sidebar && sidebar()}
        {aside && <StyledFrameAside>{aside}</StyledFrameAside>}
        <StyledFrameMainSection>
          <StyledFrameContents
            fullscreen={isFullscreen}
            data-testid="frameContents"
          >
            {contents}
          </StyledFrameContents>
        </StyledFrameMainSection>
      </StyledFrameBody>

      {statusbar && (
        <StyledFrameStatusbar
          fullscreen={isFullscreen}
          data-testid="frameStatusbar"
        >
          {statusbar}
        </StyledFrameStatusbar>
      )}
    </>
  )
}

export default FrameTemplate
