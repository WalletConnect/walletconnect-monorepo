import * as React from "react";
import styled from "styled-components";
import { SessionTypes } from "@walletconnect/types";

import { fonts, responsive } from "../styles";
import Button from "./Button";

const SHeader = styled.div`
  margin-top: -1px;
  margin-bottom: 1px;
  width: 100%;
  height: 100px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  @media screen and (${responsive.sm.max}) {
    font-size: ${fonts.size.small};
  }
`;

const SHeaderActions = styled.div`
  display: flex;
  & > button:first-child {
    margin-right: 10px !important;
  }
`;

const SActiveAccount = styled.div`
  display: flex;
  align-items: center;
  position: relative;
  font-weight: 500;
`;

const SActiveSession = styled(SActiveAccount as any)`
  flex-direction: column;
  text-align: left;
  align-items: flex-start;
  & p {
    font-size: 0.8em;
    margin: 0;
    padding: 0;
  }
  & p:nth-child(n + 2) {
    font-weight: bold;
  }
`;

interface HeaderProps {
  ping: () => Promise<void>;
  disconnect: () => Promise<void>;
  session: SessionTypes.Created | undefined;
}

const Header = (props: HeaderProps) => {
  const { ping, disconnect, session } = props;
  return (
    <SHeader {...props}>
      {session ? (
        <>
          <SActiveSession>
            <p>{`Connected to`}</p>
            <p>{session.peer.metadata.name}</p>
          </SActiveSession>
          <SHeaderActions>
            <Button outline color="black" onClick={ping}>
              {"Ping"}
            </Button>
            <Button outline color="red" onClick={disconnect}>
              {"Disconnect"}
            </Button>
          </SHeaderActions>
        </>
      ) : null}
    </SHeader>
  );
};

export default Header;
