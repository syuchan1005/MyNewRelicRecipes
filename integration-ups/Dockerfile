FROM newrelic/infrastructure-bundle

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories && apk add --no-cache nut

COPY integration.yml /etc/newrelic-infra/integrations.d/docker-config.yml

