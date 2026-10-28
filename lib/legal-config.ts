// Fill in verified operator details before issuing a final document version.
// Never put private credentials, passport details or account passwords here.
export const LEGAL_VERSION = '2026-10-26-draft-2';
export const legalOperator = {
  name: 'Зеленский Александр',
  country: 'Россия',
  contactEmail: 'zuzlsaha456@gmail.com',
  correspondenceAddress: '',
  registrationDetails: '',
  agePolicy: 'Планируется участие детей младше 14 лет через родителя, усыновителя или опекуна. Порядок подтверждения законного представителя и управления детским аккаунтом ещё готовится; публичная регистрация до его завершения закрыта',
};
// Change only after final texts, age rules and actual hosting/data processing are settled.
export const legalDocumentsFinal = false;
// Pilot launch: the site shows the draft status on its legal pages while registration is enabled.
export const legalReady = Boolean(legalOperator.name && legalOperator.country && legalOperator.contactEmail && legalOperator.agePolicy);
