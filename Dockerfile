# Following https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md

# Use the latest LTS node based on alpine linux distro
FROM node:12-alpine

# Create global installs in .npm-global in the default home directory
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin 

# No working directory needed, as we don't use this at all. We directly
# install from npm to ensure that we create dockers only of released versions.

# Install the latest version of rest-on-mongo. There is little use for anything else.
# Also, clean the npm cache to get rid of unwanted files within the image.
RUN npm install -g rest-on-mongo && npm cache --force clean

ENTRYPOINT ["rest-on-mongo"]

# This makes the process run as a non-root user (node user is builtin in the node docker)
USER node
