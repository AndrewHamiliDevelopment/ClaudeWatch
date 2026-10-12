// How large each kind of figure is drawn, as a multiple of the 1 m model. One place, because
// the sim sizes the lounge from it and the scene sizes the furniture.
export const AGENT_SCALE = 1.65
// Larger than a citizen, so a subagent is never mistaken for one.
export const SUBAGENT_SCALE = 1.4
export const CITIZEN_SCALE = 1.3

// Desks, chairs and lounges are modelled for a figure at this size, the agents' old one.
const FURNITURE_DRAWN_FOR = 1.3
// The factor agents grew by: furniture at this scale fits an agent as it did before.
export const FURNITURE_SCALE = AGENT_SCALE / FURNITURE_DRAWN_FOR
// For the desks subagents sit at: guest desks and team seats.
export const GUEST_FURNITURE_SCALE = SUBAGENT_SCALE / FURNITURE_DRAWN_FOR
