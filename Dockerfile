FROM node:18

WORKDIR /app

COPY . .

# install frontend only
RUN cd frontend/react-app && npm install

EXPOSE 3000

CMD ["npm", "start", "--prefix", "frontend/react-app"]