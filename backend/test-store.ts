const data = {
  smokingStatus: ["Former"],
  occupationType: ["Active"]
};

const payload: Record<string, any> = {};
if (data.smokingStatus !== undefined) payload.smoking = data.smokingStatus ? JSON.stringify(data.smokingStatus) : null;
if (data.occupationType !== undefined) payload.occupation = data.occupationType ? JSON.stringify(data.occupationType) : null;

console.log(payload);
