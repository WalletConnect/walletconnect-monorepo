import * as React from "react";

import Loader from "../components/Loader";
import { SContainer } from "../components/shared";

import { SModalContainer, SModalTitle } from "./shared";

interface PingModalProps {
  pending: boolean;
  result: any;
}

const PingModal = (props: PingModalProps) => {
  const { pending, result } = props;
  return (
    <>
      {pending ? (
        <SModalContainer>
          <SModalTitle>{"Pending Session Ping"}</SModalTitle>
          <SContainer>
            <Loader />
          </SContainer>
        </SModalContainer>
      ) : result ? (
        <SModalContainer>
          <SModalTitle>
            {result.valid ? "Successful Session Ping" : "Failed Session Ping"}
          </SModalTitle>
        </SModalContainer>
      ) : (
        <SModalContainer>
          <SModalTitle>{"Unknown Error with Session Ping"}</SModalTitle>
        </SModalContainer>
      )}
    </>
  );
};

export default PingModal;
