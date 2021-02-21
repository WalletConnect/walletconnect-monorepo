import * as React from "react";
import styled from "styled-components";
import { colors, shadows } from "../styles";

const SMethod = styled.div`
  border: none;
  background: rgb(${colors.white});
  border-style: none;
  padding: 12px;
  outline: none;
  font-style: normal;
  font-stretch: normal;
  line-height: normal;
  letter-spacing: normal;
  font-style: normal;
  font-stretch: normal;
  line-height: normal;
  letter-spacing: normal;
  text-align: left;
  border-radius: 8px;
  box-shadow: ${shadows.hard};
  cursor: pointer;
  margin-bottom: 10px;
`;

const Method = (props: any) => <SMethod {...props} />;

export default Method;
