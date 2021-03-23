import * as React from "react";
import styled from "styled-components";

import { PairingTypes } from "@walletconnect/types";

import Peer from "./Peer";

interface PairingProps {
  pairing: PairingTypes.Settled;
  onClick?: any;
}

const SPairingContainer = styled.div`
  width: 100%;
  cursor: pointer;
`;

const Pairing = (props: PairingProps) => {
  const {
    state: { metadata },
  } = props.pairing;
  return (
    <SPairingContainer onClick={props.onClick}>
      <div>
        {typeof metadata !== "undefined" ? (
          <Peer oneLiner metadata={metadata} />
        ) : (
          <div>{`Unknown`}</div>
        )}
      </div>
    </SPairingContainer>
  );
};

export default Pairing;
