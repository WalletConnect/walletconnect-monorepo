import * as React from "react";
import styled from "styled-components";
import { colors, shadows, transitions } from "../styles";
import ClickOutside from "./ClickOutside";

interface DropdownStyle {
  show?: boolean;
  selected?: boolean;
  disabled?: boolean;
  monospace?: boolean;
}

const SDropdown = styled.div<DropdownStyle>`
  transition: ${transitions.base};
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 6px;
  box-shadow: ${shadows.hard};
  font-family: ${({ monospace }) => (monospace ? "monospace" : "inherit")};
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
`;

const SRow = styled.div<DropdownStyle>`
  transition: ${transitions.base};
  width: 100%;
  padding: 10px 20px;
  background: rgb(${colors.white});
  border-radius: ${({ selected, show }) => (selected ? (show ? "6px 6px 0 0 " : "6px") : "none")};
  border-bottom-width: 1px;
  border-bottom-style: solid;
  border-bottom-color: ${({ show }) =>
    show ? `rgba(${colors.defaultColor}, 0.3)` : `rgba(${colors.defaultColor}, 0)`};
  &:last-child {
    border-bottom-color: rgba(${colors.defaultColor}, 0);
  }
`;

const SAbsolute = styled.div<DropdownStyle>`
  transition: ${transitions.base};
  position: absolute;
  top: 100%;
  width: 100%;
  max-height: 150px;
  overflow-x: hidden;
  overflow-y: scroll;
  z-index: 1;
  border-radius: 0 0 6px 6px;
  box-shadow: ${shadows.hard};
  opacity: ${({ show }) => (show ? "1" : "0")};
  pointer-events: ${({ show }) => (show ? "auto" : "non")};
  visibility: ${({ show }) => (show ? "visible" : "hidden")};
`;

interface DropdownState {
  show: boolean;
  optionsDict: any;
  otherKeys: any[];
}

interface DropdownProps {
  selected: number | string;
  options: any[] | any;
  displayKey: number | string;
  targetKey: number | string;
  disabled?: boolean;
  onChange?: any;
  monospace?: boolean;
}

class Dropdown extends React.Component<DropdownProps, DropdownState> {
  public state = {
    show: false,
    optionsDict: {},
    otherKeys: [],
  };

  public componentDidMount() {
    const { otherKeys, optionsDict } = this.parseKeys(this.props);
    this.setState({ otherKeys, optionsDict });
  }

  public componentDidUpdate(prevProps: DropdownProps) {
    if (prevProps.selected !== this.props.selected) {
      const { otherKeys, optionsDict } = this.parseKeys(this.props);
      this.setState({ otherKeys, optionsDict });
    }
  }

  public parseKeys = (props: {
    targetKey: number | string;
    options: any[] | object;
    selected: number | string;
  }) => {
    const { targetKey, options, selected } = props;
    let optionsDict: any = {};
    let otherKeys: any[] = [];
    if (Array.isArray(options)) {
      if (!targetKey) {
        throw new Error(`Error: "option" prop is type Array requires "targetKey" prop`);
      }
      options.forEach((option: any) => {
        const optionKey = option[targetKey];
        if (option[targetKey] !== selected) {
          otherKeys.push(optionKey);
        }
        optionsDict[optionKey] = option;
      });
    } else {
      otherKeys = Object.keys(options);
      optionsDict = options;
    }
    return { otherKeys, optionsDict };
  };

  public toggleDropdown = () => {
    if (this.props.disabled) {
      return;
    }
    this.setState({ show: !this.state.show });
  };

  public onClickOutside = () => {
    if (this.state.show) {
      this.toggleDropdown();
    }
  };

  public onChange = async (selected: string) => {
    this.toggleDropdown();
    if (this.props.onChange) {
      this.props.onChange(selected);
    }
  };

  public render() {
    const { displayKey, selected, disabled, monospace } = this.props;
    const { show, otherKeys, optionsDict } = this.state;
    return Object.keys(optionsDict).length ? (
      <ClickOutside onClickOutside={this.onClickOutside}>
        <SDropdown monospace={!!monospace} disabled={disabled || !otherKeys.length}>
          <SRow selected={true} show={show} onClick={this.toggleDropdown}>
            {(optionsDict as any)[selected][displayKey]}
          </SRow>
          {!!otherKeys.length && (
            <SAbsolute show={show}>
              {otherKeys.map((otherKey, idx) => (
                <SRow
                  show={show}
                  onClick={() => this.onChange(otherKey)}
                  key={`${otherKey}-${idx}`}
                >
                  {optionsDict[otherKey][displayKey]}
                </SRow>
              ))}
            </SAbsolute>
          )}
        </SDropdown>
      </ClickOutside>
    ) : null;
  }
}

export default Dropdown;
