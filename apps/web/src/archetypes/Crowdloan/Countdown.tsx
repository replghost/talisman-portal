import { Countdown as Cd, Pendor } from '@components'
import styled from '@emotion/styled'
import { useChainmetaValue, useCrowdloanById } from '@libs/talisman'
import { ReactNode, useEffect, useState } from 'react'

type OngoingProps = {
  end?: number
  showSeconds?: boolean
  className?: string
  relayChainId?: number
}

const Ongoing = ({ end, showSeconds, relayChainId, className = '' }: OngoingProps) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>()
  const blockNumber = useChainmetaValue(relayChainId!, 'blockNumber')
  const blockPeriod = useChainmetaValue(relayChainId!, 'blockPeriod')

  useEffect(() => {
    if (!end || !blockNumber || !blockPeriod) return
    setSecondsRemaining((end - blockNumber) * blockPeriod)
  }, [end, blockNumber, blockPeriod])

  return (
    <Pendor require={!!secondsRemaining}>
      <div className={`crowdloan-countdown ongoing ${className}`}>
        <Cd showSeconds={showSeconds} seconds={secondsRemaining} />
      </div>
    </Pendor>
  )
}

const Generic = styled(({ text, className }: { className?: string; text: ReactNode }) => (
  <span className={`crowdloan-countdown finished ${className}`}>{text}</span>
))`
  display: flex;
  align-items: center;
`

type CountdownProps = {
  id?: string
  end?: number
  showSeconds?: boolean
  className?: string
}

const Countdown: React.FC<CountdownProps> = ({ id, showSeconds, className, ...rest }) => {
  const { crowdloan } = useCrowdloanById(id)

  // Pendor
  if (!crowdloan) return <Ongoing />

  const { uiStatus, lockExpiredBlock } = crowdloan

  if (['active', 'capped'].includes(uiStatus)) {
    return <Ongoing {...rest} showSeconds={showSeconds} end={lockExpiredBlock} relayChainId={crowdloan?.relayChainId} />
  }
  if (uiStatus === 'winner') return <Generic text="Winner" />
  if (uiStatus === 'ended') return <Generic text="Ended" />

  // Pendor
  return <Ongoing />
}

export default Countdown
