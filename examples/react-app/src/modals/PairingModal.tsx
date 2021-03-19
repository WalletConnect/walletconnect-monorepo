import * as React from "react";

import { PairingTypes } from "@walletconnect/types";

import Button from "../components/Button";
import Pairing from "../components/Pairing";
import { STable } from "../components/shared";

import { SModalContainer, SModalTitle } from "./shared";

interface PairingModalProps {
  pairings: PairingTypes.Settled[];
  connect: (pairing?: { topic: string }) => Promise<void>;
}

const PairingModal = (props: PairingModalProps) => {
  const { pairings, connect } = props;
  return (
    <SModalContainer>
      <SModalTitle>{"Select available pairing or create new one"}</SModalTitle>
      <STable>
        {pairings.map(pairing => (
          <Pairing
            key={pairing.topic}
            pairing={pairing}
            onClick={() => connect({ topic: pairing.topic })}
          />
        ))}
      </STable>
      <Button onClick={() => connect()}>{`New Pairing`}</Button>
    </SModalContainer>
  );
};

export default PairingModal;
