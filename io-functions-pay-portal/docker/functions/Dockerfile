FROM node:12.19.1@sha256:3caf9292d6d7e47ee207e49afada5dc3165dcdc8422201dba7c6547dc883efea

WORKDIR /usr/src/app

RUN npm i -g azure-functions-core-tools@2 --unsafe-perm true

ENV AzureWebJobsScriptRoot=/usr/src/app \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

CMD ["func", "start", "--javascript"]
