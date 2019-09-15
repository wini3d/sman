const config = require('./../../config')
const githubToken = config.get('githubToken')
const helpers = require('./../helpers')
const nock = require('nock')
const querystring = require('querystring')
const request = helpers.wrappedRequest
const sampleData = require('./../helpers/sampleData')
const StaticmanAPI = require('./../../server')

const btoa = contents => Buffer.from(contents).toString('base64')

let server

beforeAll(done => {
  server = new StaticmanAPI()

  server.start(done)
})

afterAll(done => {
  server.close()
})

describe('Connect endpoint', () => {
  test('accepts the invitation if one is found and replies with "OK!"', () => {
    const invitationId = 123

    const reqListInvititations = nock(/api\.github\.com/)
      .get(`/user/repository_invitations?access_token=${githubToken}`)
      .reply(200, [
        {
          id: invitationId,
          repository: {
            full_name: `johndoe/foobar`
          }
        }
      ])

    const reqAcceptInvitation = nock(/api\.github\.com/)
      .patch(`/user/repository_invitations/${invitationId}?access_token=${githubToken}`)
      .reply(204)

    return request('/v2/connect/johndoe/foobar')
      .then(response => {
        expect(reqListInvititations.isDone()).toBe(true)
        expect(reqAcceptInvitation.isDone()).toBe(true)
        expect(response).toBe('OK!')
      })
  })

  test('returns a 404 and an error message if a matching invitation is not found', () => {
    const invitationId = 123
    const reqListInvititations = nock(/api\.github\.com/)
      .get(`/user/repository_invitations?access_token=${githubToken}`)
      .reply(200, [
        {
          id: invitationId,
          repository: {
            full_name: `johndoe/anotherrepo`
          }
        }
      ])

    const reqAcceptInvitation = nock(/api\.github\.com/)
      .patch(`/user/repository_invitations/${invitationId}?access_token=${githubToken}`)
      .reply(204)

    return request('/v2/connect/johndoe/foobar')
      .catch(err => {
        expect(reqListInvititations.isDone()).toBe(true)
        expect(reqAcceptInvitation.isDone()).toBe(false)
        expect(err.response.body).toBe('Invitation not found')
        expect(err.statusCode).toBe(404)
      })
  })
})

describe.only('Entry endpoint', () => {
  test('outputs a RECAPTCHA_CONFIG_MISMATCH error if reCaptcha options do not match (wrong site key)', () => {
    const data = Object.assign({}, helpers.getParameters(), {
      path: 'staticman.yml'
    })
    const reCaptchaSecret = helpers.encrypt('Some little secret')
    const mockConfig = sampleData.config1
      .replace('@reCaptchaSecret@', reCaptchaSecret)

    nock(/api\.github\.com/, {
      reqHeaders: {
        Authorization: `token ${githubToken}`
      }
    })
      .get(`/repos/${data.username}/${data.repository}/contents/${data.path}?ref=${data.branch}`)
      .reply(200, {
        type: 'file',
        encoding: 'base64',
        size: 5362,
        name: 'staticman.yml',
        path: 'staticman.yml',
        content: btoa(mockConfig),
        sha: '3d21ec53a331a6f037a91c368710b99387d012c1',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
        git_url: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
        html_url: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml',
        download_url: 'https://raw.githubusercontent.com/octokit/octokit.rb/master/staticman.yml',
        _links: {
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
          html: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml'
        }
      })

    const form = {
      'fields[name]': 'Eduardo Boucas',
      'options[reCaptcha][siteKey]': 'wrongSiteKey',
      'options[reCaptcha][secret]': reCaptchaSecret
    }
    const formData = querystring.stringify(form)

    return request({
      body: formData,
      method: 'POST',
      uri: '/v2/entry/johndoe/foobar/master/comments',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    }).catch((response) => {
      const error = JSON.parse(response.error)

      expect(error.success).toBe(false)
      expect(error.errorCode).toBe('RECAPTCHA_CONFIG_MISMATCH')
      expect(error.message).toBe('reCAPTCHA options do not match Staticman config')
    })
  })

  test('outputs a RECAPTCHA_CONFIG_MISMATCH error if reCaptcha options do not match (wrong secret)', () => {
    const data = Object.assign({}, helpers.getParameters(), {
      path: 'staticman.yml'
    })
    const reCaptchaSecret = 'Some little secret'
    const mockConfig = sampleData.config1
      .replace('@reCaptchaSecret@', helpers.encrypt(reCaptchaSecret))

    nock(/api\.github\.com/, {
      reqHeaders: {
        Authorization: `token ${githubToken}`
      }
    })
      .get(`/repos/${data.username}/${data.repository}/contents/${data.path}?ref=${data.branch}`)
      .reply(200, {
        type: 'file',
        encoding: 'base64',
        size: 5362,
        name: 'staticman.yml',
        path: 'staticman.yml',
        content: btoa(mockConfig),
        sha: '3d21ec53a331a6f037a91c368710b99387d012c1',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
        git_url: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
        html_url: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml',
        download_url: 'https://raw.githubusercontent.com/octokit/octokit.rb/master/staticman.yml',
        _links: {
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
          html: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml'
        }
      })

    const form = {
      'fields[name]': 'Eduardo Boucas',
      'options[reCaptcha][siteKey]': '123456789',
      'options[reCaptcha][secret]': 'foo'
    }
    const formData = querystring.stringify(form)

    return request({
      body: formData,
      method: 'POST',
      uri: '/v2/entry/johndoe/foobar/master/comments',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    }).catch(response => {
      const error = JSON.parse(response.error)

      expect(error.success).toBe(false)
      expect(error.errorCode).toBe('RECAPTCHA_CONFIG_MISMATCH')
      expect(error.message).toBe('reCAPTCHA options do not match Staticman config')
    })
  })

  test('outputs a PARSING_ERROR error the site config is malformed', () => {
    const data = Object.assign({}, helpers.getParameters(), {
      path: 'staticman.yml'
    })

    const mockGetConfig = nock(/api\.github\.com/, {
      reqHeaders: {
        Authorization: `token ${githubToken}`
      }
    })
      .get(`/repos/${data.username}/${data.repository}/contents/${data.path}?ref=${data.branch}`)
      .reply(200, {
        type: 'file',
        encoding: 'base64',
        size: 5362,
        name: 'staticman.yml',
        path: 'staticman.yml',
        content: btoa(sampleData.config3),
        sha: '3d21ec53a331a6f037a91c368710b99387d012c1',
        url: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
        git_url: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
        html_url: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml',
        download_url: 'https://raw.githubusercontent.com/octokit/octokit.rb/master/staticman.yml',
        _links: {
          git: 'https://api.github.com/repos/octokit/octokit.rb/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
          self: 'https://api.github.com/repos/octokit/octokit.rb/contents/staticman.yml',
          html: 'https://github.com/octokit/octokit.rb/blob/master/staticman.yml'
        }
      })

    const form = {
      'fields[name]': 'Eduardo Boucas'
    }
    const formData = querystring.stringify(form)

    return request({
      body: formData,
      method: 'POST',
      uri: '/v2/entry/johndoe/foobar/master/comments',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      }
    }).catch(response => {
      const error = JSON.parse(response.error)

      expect(error.success).toBe(false)
      expect(error.errorCode).toBe('PARSING_ERROR')
      expect(error.message).toBeDefined()
      expect(error.rawError).toBeDefined()
    })
  })
})
