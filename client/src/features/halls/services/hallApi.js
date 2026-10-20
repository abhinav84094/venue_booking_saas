import api from "../../../services/api";
export const saveHall = (hallBase, input) => api.patch(hallBase, input);
export const createHall = (venueBase, input) => api.post(`${venueBase}/halls`, input);
