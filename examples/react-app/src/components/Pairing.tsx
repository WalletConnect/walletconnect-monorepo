import * as React from "react";
import styled from "styled-components";

import { PairingTypes } from "@walletconnect/types";

import { colors, fonts } from "../styles";
import Peer from "./Peer";

interface PairingProps {
  pairing: PairingTypes.Settled;
  onClick?: any;
}

const SPairingContainer = styled.div`
  width: 100%;
  border: 2px solid rgb(${colors.dark});
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
`;

const SPairingTopic = styled.div`
  font-size: ${fonts.size.tiny};
`;

const Pairing = (props: PairingProps) => {
  const {
    topic,
    state: { metadata },
  } = props.pairing;
  return (
    <SPairingContainer onClick={props.onClick}>
      <SPairingTopic>{topic}</SPairingTopic>
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
