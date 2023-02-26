const NEU = 'seed/animation/NEU';

export default (state = {}, action = {}) => {
  switch (action.type) {
    case NEU:
      return {
        ...state
      };
    default:
      return state;
  }
};

export const neu = () => ({ type: NEU });
