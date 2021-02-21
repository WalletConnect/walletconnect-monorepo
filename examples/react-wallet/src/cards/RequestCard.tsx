import * as React from "react";
import styled from "styled-components";
import { SessionTypes } from "@walletconnect/types";
import { isJsonRpcResponse } from "@json-rpc-tools/utils";

import Column from "../components/Column";
import Button from "../components/Button";
import Blockchain from "../components/Blockchain";

import { getChainRequestRender } from "../chains";
import Peer from "../components/Peer";

const SValue = styled.div`
  font-family: monospace;
  width: 100%;
  font-size: 12px;
  background-color: #eee;
  padding: 8px;
  word-break: break-word;
  border-radius: 8px;
  margin-bottom: 10px;
`;

const SActions = styled.div`
  margin: 0;
  margin-top: 20px;

  display: flex;
  justify-content: space-around;
  & > * {
    margin: 0 5px;
  }
`;

interface RequestCardProps {
  chainId: string;
  request: SessionTypes.PayloadEvent;
  peerMeta: SessionTypes.Metadata;
  approveRequest: (request: SessionTypes.PayloadEvent) => void;
  rejectRequest: (request: SessionTypes.PayloadEvent) => void;
}

const RequestCard = (props: RequestCardProps) => {
  const { chainId, request, peerMeta, approveRequest, rejectRequest } = props;
  if (isJsonRpcResponse(request.payload)) return null;
  const params = getChainRequestRender(request.payload, chainId);
  console.log("RENDER", "method", request.payload.method);
  console.log("RENDER", "params", request.payload.params);
  console.log("RENDER", "formatted", params);

  return (
    <Column>
      <h6>{"App"}</h6>
      <Peer oneLiner peerMeta={peerMeta} />
      <h6>{"Chain"}</h6>
      <Blockchain key={`request:chain:${chainId}`} chainId={chainId} />
      {params.map((param) => (
        <React.Fragment key={param.label}>
          <h6>{param.label}</h6>
          <SValue>{param.value}</SValue>
        </React.Fragment>
      ))}
      <SActions>
        <Button onClick={() => approveRequest(request)}>{`Approve`}</Button>
        <Button onClick={() => rejectRequest(request)}>{`Reject`}</Button>
      </SActions>
    </Column>
  );
};

export default RequestCard;
